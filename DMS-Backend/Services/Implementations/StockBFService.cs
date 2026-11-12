using Microsoft.EntityFrameworkCore;
using AutoMapper;
using DMS_Backend.Common;
using DMS_Backend.Data;
using DMS_Backend.Models.Entities;
using DMS_Backend.Models.DTOs.StockBF;
using DMS_Backend.Models.DTOs.FreezerStocks;
using DMS_Backend.Services.Interfaces;
using Npgsql;

namespace DMS_Backend.Services.Implementations;

public class StockBFService : IStockBFService
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly IFreezerStockService _freezerStockService;
    private readonly IAutoApprovalConfigService _autoApprovalConfigService;

    private static DateTime EnsureUtc(DateTime dt)
    {
        return dt.Kind switch
        {
            DateTimeKind.Utc => dt,
            DateTimeKind.Local => dt.ToUniversalTime(),
            _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc),
        };
    }

    private static DateTime InclusiveEndUtc(DateTime dt)
    {
        var utc = EnsureUtc(dt);
        return utc.TimeOfDay == TimeSpan.Zero ? utc.AddDays(1).AddTicks(-1) : utc;
    }

    private static void ValidateBfDateRules(DateTime bfDate, bool relaxedBfDateRules)
    {
        if (relaxedBfDateRules)
            return;

        var slDate = DeliveryPlanPreloadRules.ResolvePlanBusinessDateSriLanka(bfDate);
        var today = DeliveryPlanPreloadRules.TodaySriLanka();
        if (slDate > today)
            throw new ArgumentException("BF date cannot be in the future.");
        if (slDate < today.AddDays(-3))
            throw new ArgumentException("BF date cannot be more than 3 days in the past.");
    }

    private static DateTime CanonicalBfDateUtc(DateTime bfDate) =>
        DeliveryPlanPreloadRules.SlDateToUtcMidnight(
            DeliveryPlanPreloadRules.ResolvePlanBusinessDateSriLanka(bfDate));

    private static bool IsStockBfUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException pg &&
        pg.SqlState == PostgresErrorCodes.UniqueViolation &&
        (pg.ConstraintName == "IX_stock_bf_outlet_id_bf_date_product_id" ||
         (pg.ConstraintName?.Contains("stock_bf", StringComparison.OrdinalIgnoreCase) == true &&
          pg.ConstraintName.Contains("outlet", StringComparison.OrdinalIgnoreCase)));

    /// <summary>
    /// Occupancy window covering both Colombo-midnight UTC rows and legacy UTC calendar-date rows.
    /// </summary>
    private static (DateTime StartUtc, DateTime EndUtc) BfDayRangeUtc(DateTime bfDate)
    {
        var sl = DeliveryPlanPreloadRules.ResolvePlanBusinessDateSriLanka(bfDate);
        var slStart = DeliveryPlanPreloadRules.SlDateToUtcMidnight(sl);
        var slEnd = DeliveryPlanPreloadRules.SlDateToUtcMidnight(sl.AddDays(1));
        var utcStart = DateTime.SpecifyKind(new DateTime(sl.Year, sl.Month, sl.Day), DateTimeKind.Utc);
        var utcEnd = utcStart.AddDays(1);
        var start = slStart < utcStart ? slStart : utcStart;
        var end = slEnd > utcEnd ? slEnd : utcEnd;
        return (start, end);
    }

    private IQueryable<StockBF> StockBFDetailQuery =>
        _context.StockBFs
            .Include(s => s.Outlet)
            .Include(s => s.Product)
            .Include(s => s.CreatedBy)
            .Include(s => s.UpdatedBy)
            .Include(s => s.ApprovedBy)
            .Include(s => s.RejectedBy);

    private async Task<List<StockBF>> GetActiveStockBFsByOutletDateProductsAsync(
        Guid outletId,
        DateTime bfDateUtc,
        IEnumerable<Guid> productIds,
        CancellationToken cancellationToken)
    {
        var ids = productIds.Distinct().ToList();
        if (ids.Count == 0)
            return [];

        var (dayStart, dayEnd) = BfDayRangeUtc(bfDateUtc);
        return await StockBFDetailQuery
            .Where(s => s.OutletId == outletId &&
                        s.BFDate >= dayStart &&
                        s.BFDate < dayEnd &&
                        ids.Contains(s.ProductId) &&
                        s.IsActive &&
                        s.Status != StockBFStatus.Rejected)
            .ToListAsync(cancellationToken);
    }

    private static InvalidOperationException StockBfAlreadySubmitted() =>
        new("Opening stock for this showroom and date is already submitted. Re-entry is allowed only after the record is rejected.");

    private async Task<List<StockBF>> GetBlockingStockBfsForOutletDateAsync(
        Guid outletId,
        DateTime bfDateUtc,
        CancellationToken cancellationToken)
    {
        var (dayStart, dayEnd) = BfDayRangeUtc(bfDateUtc);
        return await StockBFDetailQuery
            .Where(s => s.IsActive &&
                        s.OutletId == outletId &&
                        s.BFDate >= dayStart &&
                        s.BFDate < dayEnd &&
                        s.Status != StockBFStatus.Rejected)
            .ToListAsync(cancellationToken);
    }

    /// <summary>
    /// Rejected rows must not occupy (outlet, date, product) uniqueness so POS can submit again.
    /// Some client databases still have a non-filtered unique index.
    /// </summary>
    private async Task ReleaseRejectedUniqueSlotsAsync(
        Guid outletId,
        DateTime bfDateUtc,
        IEnumerable<Guid>? productIds,
        CancellationToken cancellationToken)
    {
        var (dayStart, dayEnd) = BfDayRangeUtc(bfDateUtc);
        var ids = productIds?.Distinct().ToList();
        var query = _context.StockBFs.Where(s =>
            s.OutletId == outletId &&
            s.Status == StockBFStatus.Rejected &&
            s.BFDate >= dayStart &&
            s.BFDate < dayEnd);
        if (ids is { Count: > 0 })
            query = query.Where(s => ids.Contains(s.ProductId));

        var rejected = await query.ToListAsync(cancellationToken);
        if (rejected.Count == 0)
            return;

        var nowTicks = DateTime.UtcNow.Ticks;
        var (_, rangeEnd) = BfDayRangeUtc(bfDateUtc);
        for (var i = 0; i < rejected.Count; i++)
        {
            rejected[i].BFDate = rangeEnd.AddTicks(-(i + 1));
            rejected[i].UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    private async Task<List<StockBFDetailDto>> TryReturnExistingBulkAsync(
        Guid outletId,
        DateTime bfDateUtc,
        List<Guid> requestedProductIds,
        CancellationToken cancellationToken)
    {
        var distinctRequested = requestedProductIds.Distinct().ToList();
        var existingActive = await GetActiveStockBFsByOutletDateProductsAsync(
            outletId, bfDateUtc, distinctRequested, cancellationToken);

        if (existingActive.Count == 0)
            return [];

        var existingProductIds = existingActive.Select(s => s.ProductId).ToHashSet();
        if (!distinctRequested.All(existingProductIds.Contains))
            return [];

        return _mapper.Map<List<StockBFDetailDto>>(existingActive);
    }

    private async Task ValidateProductsDisplayInPosAsync(
        IEnumerable<Guid> productIds,
        CancellationToken cancellationToken)
    {
        var ids = productIds.Distinct().ToList();
        if (ids.Count == 0)
            return;

        var flagged = await _context.Products
            .AsNoTracking()
            .Where(p => ids.Contains(p.Id) && (!p.DisplayInPOS || !p.RequireOpenStock))
            .Select(p => p.Name)
            .ToListAsync(cancellationToken);

        if (flagged.Count > 0)
        {
            throw new InvalidOperationException(
                "Stock BF is only allowed for products that are displayed in POS and have Require Open Stock enabled. " +
                $"Not allowed: {string.Join(", ", flagged)}");
        }
    }

    public StockBFService(ApplicationDbContext context, IMapper mapper, IFreezerStockService freezerStockService, IAutoApprovalConfigService autoApprovalConfigService)
    {
        _context = context;
        _mapper = mapper;
        _freezerStockService = freezerStockService;
        _autoApprovalConfigService = autoApprovalConfigService;
    }

    public async Task<(List<StockBFListDto> StockBFs, int TotalCount)> GetAllAsync(
        int page, int pageSize, DateTime? fromDate, DateTime? toDate,
        Guid? outletId, Guid? productId, string? status,
        Guid requestingUserId,
        bool viewAllRecords,
        bool showPreviousRecords,
        CancellationToken cancellationToken = default)
    {
        var query = _context.StockBFs
            .Include(s => s.Outlet)
            .Include(s => s.Product)
            .Include(s => s.UpdatedBy)
            .Include(s => s.ApprovedBy)
            .Include(s => s.RejectedBy)
            .Where(s => s.IsActive)
            .AsQueryable();

        if (!viewAllRecords)
        {
            query = query.Where(s => s.CreatedById == requestingUserId);
            if (!showPreviousRecords)
            {
                var minBfDate = DateTime.UtcNow.Date.AddDays(-3);
                query = query.Where(s => s.BFDate >= minBfDate);
            }
        }

        if (fromDate.HasValue)
        {
            var (start, _) = BfDayRangeUtc(fromDate.Value);
            query = query.Where(s => s.BFDate >= start);
        }

        if (toDate.HasValue)
        {
            var (_, end) = BfDayRangeUtc(toDate.Value);
            query = query.Where(s => s.BFDate < end);
        }

        if (outletId.HasValue)
            query = query.Where(s => s.OutletId == outletId.Value);

        if (productId.HasValue)
            query = query.Where(s => s.ProductId == productId.Value);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<StockBFStatus>(status, true, out var statusEnum))
            query = query.Where(s => s.Status == statusEnum);

        var totalCount = await query.CountAsync(cancellationToken);

        var stockBFs = await query
            .OrderByDescending(s => s.BFDate)
            .ThenByDescending(s => s.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (_mapper.Map<List<StockBFListDto>>(stockBFs), totalCount);
    }

    public async Task<(List<StockBFGroupDto> Groups, int TotalCount)> GetAllGroupedAsync(
        int page, int pageSize, DateTime? fromDate, DateTime? toDate,
        Guid? outletId, Guid? productId, string? status,
        Guid requestingUserId,
        bool viewAllRecords,
        bool showPreviousRecords,
        CancellationToken cancellationToken = default)
    {
        var query = _context.StockBFs
            .Include(s => s.Outlet)
            .Include(s => s.Product)
            .Include(s => s.CreatedBy)
            .Include(s => s.UpdatedBy)
            .Include(s => s.ApprovedBy)
            .Include(s => s.RejectedBy)
            .Where(s => s.IsActive)
            .AsQueryable();

        if (!viewAllRecords)
        {
            query = query.Where(s => s.CreatedById == requestingUserId);
            if (!showPreviousRecords)
            {
                var minBfDate = DateTime.UtcNow.Date.AddDays(-3);
                query = query.Where(s => s.BFDate >= minBfDate);
            }
        }

        if (fromDate.HasValue)
        {
            var (start, _) = BfDayRangeUtc(fromDate.Value);
            query = query.Where(s => s.BFDate >= start);
        }

        if (toDate.HasValue)
        {
            var (_, end) = BfDayRangeUtc(toDate.Value);
            query = query.Where(s => s.BFDate < end);
        }

        if (outletId.HasValue)
            query = query.Where(s => s.OutletId == outletId.Value);

        if (productId.HasValue)
            query = query.Where(s => s.ProductId == productId.Value);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<StockBFStatus>(status, true, out var statusEnum))
            query = query.Where(s => s.Status == statusEnum);

        // Get all records for grouping
        var allRecords = await query
            .OrderByDescending(s => s.BFDate)
            .ThenByDescending(s => s.CreatedAt)
            .ToListAsync(cancellationToken);

        // Group by BF Number (all items with the same BFNo are part of the same submission)
        var groups = allRecords
            .GroupBy(s => s.BFNo)
            .Select(g =>
            {
                var items = g.OrderBy(x => x.Product?.Name ?? x.ProductId.ToString()).ToList();
                var first = items[0];
                var statuses = items.Select(x => x.Status).Distinct().ToList();
                var hasMixedStatus = statuses.Count > 1;
                var commonStatus = hasMixedStatus ? StockBFStatus.Pending : statuses[0];

                return new StockBFGroupDto
                {
                    GroupId = first.Id,
                    BFDate = first.BFDate,
                    OutletId = first.OutletId,
                    OutletCode = first.Outlet?.Code ?? "",
                    OutletName = first.Outlet?.Name ?? "",
                    ItemCount = items.Count,
                    TotalQuantity = items.Sum(x => x.Quantity),
                    Status = commonStatus.ToString(),
                    HasMixedStatus = hasMixedStatus,
                    CreatedByName = first.CreatedBy?.FullName ?? "",
                    CreatedAt = first.CreatedAt,
                    UpdatedByName = items.OrderByDescending(x => x.UpdatedAt).First().UpdatedBy?.FullName,
                    UpdatedAt = items.Max(x => x.UpdatedAt),
                    ApprovedByName = items.FirstOrDefault(x => x.ApprovedBy != null)?.ApprovedBy?.FullName,
                    ApprovedDate = items.FirstOrDefault(x => x.ApprovedDate != null)?.ApprovedDate,
                    RejectedByName = items.FirstOrDefault(x => x.RejectedBy != null)?.RejectedBy?.FullName,
                    RejectedDate = items.FirstOrDefault(x => x.RejectedDate != null)?.RejectedDate,
                    Items = _mapper.Map<List<StockBFListDto>>(items)
                };
            })
            .OrderByDescending(g => g.BFDate)
            .ThenByDescending(g => g.CreatedAt)
            .ToList();

        var totalCount = groups.Count;
        var paginatedGroups = groups
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return (paginatedGroups, totalCount);
    }

    public async Task<StockBFDetailDto?> GetByIdAsync(
        Guid id,
        Guid requestingUserId,
        bool viewAllRecords,
        CancellationToken cancellationToken = default,
        bool ignoreOwnership = false)
    {
        var stockBF = await _context.StockBFs
            .Include(s => s.Outlet)
            .Include(s => s.Product)
            .Include(s => s.CreatedBy)
            .Include(s => s.UpdatedBy)
            .Include(s => s.ApprovedBy)
            .Include(s => s.RejectedBy)
            .FirstOrDefaultAsync(s => s.Id == id && s.IsActive, cancellationToken);

        if (stockBF == null)
            return null;

        if (!ignoreOwnership && !viewAllRecords && stockBF.CreatedById != requestingUserId)
            return null;

        return _mapper.Map<StockBFDetailDto>(stockBF);
    }

    public async Task<StockBFDetailDto?> GetByBFNoAsync(string bfNo, CancellationToken cancellationToken = default)
    {
        var stockBF = await _context.StockBFs
            .Include(s => s.Outlet)
            .Include(s => s.Product)
            .Include(s => s.CreatedBy)
            .Include(s => s.UpdatedBy)
            .Include(s => s.ApprovedBy)
            .Include(s => s.RejectedBy)
            .FirstOrDefaultAsync(s => s.BFNo == bfNo && s.IsActive, cancellationToken);

        if (stockBF == null)
            return null;

        return _mapper.Map<StockBFDetailDto>(stockBF);
    }

    public async Task<List<StockBFDetailDto>> GetAllByBFNoAsync(string bfNo, CancellationToken cancellationToken = default)
    {
        var stockBFs = await _context.StockBFs
            .Include(s => s.Outlet)
            .Include(s => s.Product)
            .Include(s => s.CreatedBy)
            .Include(s => s.UpdatedBy)
            .Include(s => s.ApprovedBy)
            .Include(s => s.RejectedBy)
            .Where(s => s.BFNo == bfNo && s.IsActive)
            .OrderBy(s => s.Product != null ? s.Product.Name : s.ProductId.ToString())
            .ToListAsync(cancellationToken);

        return _mapper.Map<List<StockBFDetailDto>>(stockBFs);
    }


    public async Task<StockBFDetailDto> CreateAsync(
        CreateStockBFDto dto,
        Guid userId,
        List<string> permissionCodes,
        bool relaxedBfDateRules,
        CancellationToken cancellationToken = default)
    {
        var bfDateUtc = CanonicalBfDateUtc(dto.BFDate);
        ValidateBfDateRules(dto.BFDate, relaxedBfDateRules);

        await ReleaseRejectedUniqueSlotsAsync(dto.OutletId, bfDateUtc, new[] { dto.ProductId }, cancellationToken);
        var blocking = await GetBlockingStockBfsForOutletDateAsync(dto.OutletId, bfDateUtc, cancellationToken);
        var existingForProduct = blocking.FirstOrDefault(s => s.ProductId == dto.ProductId);
        if (existingForProduct != null)
        {
            return _mapper.Map<StockBFDetailDto>(existingForProduct);
        }

        if (blocking.Count > 0)
            throw StockBfAlreadySubmitted();

        await ValidateProductsDisplayInPosAsync(new[] { dto.ProductId }, cancellationToken);

        // Check auto-approval configuration
        var autoApprovalEnabled = await _autoApprovalConfigService.IsAutoApprovalEnabledAsync("operation:stock-bf", cancellationToken);
        var canAutoApprove = permissionCodes.Contains("*") || permissionCodes.Contains("operation:stock-bf:auto-approve");
        var shouldAutoApprove = autoApprovalEnabled && canAutoApprove;

        // Generate BF Number for single item creation
        var bfNo = await GenerateNextStockBFNoAsync(cancellationToken);

        var stockBF = new StockBF
        {
            Id = Guid.NewGuid(),
            BFNo = bfNo,
            BFDate = bfDateUtc,
            OutletId = dto.OutletId,
            ProductId = dto.ProductId,
            Quantity = dto.Quantity,
            Status = shouldAutoApprove ? StockBFStatus.Approved : StockBFStatus.Pending,
            CreatedById = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        if (shouldAutoApprove)
        {
            stockBF.ApprovedById = userId;
            stockBF.ApprovedDate = DateTime.UtcNow;
        }

        _context.StockBFs.Add(stockBF);
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsStockBfUniqueViolation(ex))
        {
            var replay = await GetActiveStockBFsByOutletDateProductsAsync(
                dto.OutletId, bfDateUtc, new[] { dto.ProductId }, cancellationToken);
            if (replay.Count > 0)
                return _mapper.Map<StockBFDetailDto>(replay[0]);

            _context.Entry(stockBF).State = EntityState.Detached;
            await ReleaseRejectedUniqueSlotsAsync(dto.OutletId, bfDateUtc, new[] { dto.ProductId }, cancellationToken);
            _context.StockBFs.Add(stockBF);
            await _context.SaveChangesAsync(cancellationToken);
        }

        if (shouldAutoApprove)
            await ApplyOpeningStockAsync(stockBF, userId, cancellationToken);

        return await GetByIdAsync(stockBF.Id, userId, viewAllRecords: false, cancellationToken)
            ?? throw new InvalidOperationException("Failed to retrieve created stock BF");
    }

    public async Task<List<StockBFDetailDto>> CreateBulkAsync(
        CreateBulkStockBFDto dto,
        Guid userId,
        List<string> permissionCodes,
        bool relaxedBfDateRules,
        CancellationToken cancellationToken = default)
    {
        if (dto.Items == null || dto.Items.Count == 0)
            throw new ArgumentException("At least one item is required");

        var bfDateUtc = CanonicalBfDateUtc(dto.BFDate);
        ValidateBfDateRules(dto.BFDate, relaxedBfDateRules);

        var autoApprovalEnabled = await _autoApprovalConfigService.IsAutoApprovalEnabledAsync("operation:stock-bf", cancellationToken);
        var canAutoApprove = permissionCodes.Contains("*") || permissionCodes.Contains("operation:stock-bf:auto-approve");
        var shouldAutoApprove = autoApprovalEnabled && canAutoApprove;

        // Idempotency: Check if this mutation has already been processed (ignore rejected rows)
        if (!string.IsNullOrWhiteSpace(dto.ClientMutationId))
        {
            var existingByMutationId = await _context.StockBFs
                .Include(s => s.Outlet)
                .Include(s => s.Product)
                .Include(s => s.CreatedBy)
                .Include(s => s.UpdatedBy)
                .Include(s => s.ApprovedBy)
                .Include(s => s.RejectedBy)
                .Where(s => s.ClientMutationId == dto.ClientMutationId &&
                           s.OutletId == dto.OutletId &&
                           s.BFDate == bfDateUtc &&
                           s.IsActive &&
                           s.Status != StockBFStatus.Rejected)
                .ToListAsync(cancellationToken);

            if (existingByMutationId.Any())
            {
                return _mapper.Map<List<StockBFDetailDto>>(existingByMutationId);
            }
        }

        var duplicateProducts = dto.Items
            .GroupBy(i => i.ProductId)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToList();

        if (duplicateProducts.Any())
            throw new ArgumentException("Duplicate products found in the request");

        var productIds = dto.Items.Select(i => i.ProductId).ToList();
        await ReleaseRejectedUniqueSlotsAsync(dto.OutletId, bfDateUtc, productIds, cancellationToken);
        var blocking = await GetBlockingStockBfsForOutletDateAsync(dto.OutletId, bfDateUtc, cancellationToken);
        if (blocking.Count > 0)
        {
            var idempotentReplay = await TryReturnExistingBulkAsync(
                dto.OutletId, bfDateUtc, productIds, cancellationToken);
            if (idempotentReplay.Count > 0)
                return idempotentReplay;

            throw StockBfAlreadySubmitted();
        }

        await ValidateProductsDisplayInPosAsync(dto.Items.Select(i => i.ProductId), cancellationToken);

        var now = DateTime.UtcNow;
        var createdIds = new List<Guid>();
        
        // Generate ONE BF number for ALL items in this bulk submission
        var sharedBFNo = await GenerateNextStockBFNoAsync(cancellationToken);

        foreach (var item in dto.Items)
        {
            var stockBF = new StockBF
            {
                Id = Guid.NewGuid(),
                BFNo = sharedBFNo,  // Use the same BF number for all items
                BFDate = bfDateUtc,
                OutletId = dto.OutletId,
                ProductId = item.ProductId,
                Quantity = item.Quantity,
                Status = shouldAutoApprove ? StockBFStatus.Approved : StockBFStatus.Pending,
                ClientMutationId = string.IsNullOrWhiteSpace(dto.ClientMutationId) ? null : dto.ClientMutationId.Trim(),
                CreatedById = userId,
                CreatedAt = now,
                UpdatedAt = now
            };

            if (shouldAutoApprove)
            {
                stockBF.ApprovedById = userId;
                stockBF.ApprovedDate = now;
            }

            _context.StockBFs.Add(stockBF);
            createdIds.Add(stockBF.Id);
        }

        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsStockBfUniqueViolation(ex))
        {
            var replay = await TryReturnExistingBulkAsync(
                dto.OutletId, bfDateUtc, productIds, cancellationToken);
            if (replay.Count > 0)
                return replay;

            foreach (var entry in _context.ChangeTracker.Entries<StockBF>().Where(e => e.State == EntityState.Added).ToList())
                entry.State = EntityState.Detached;

            await ReleaseRejectedUniqueSlotsAsync(dto.OutletId, bfDateUtc, productIds, cancellationToken);

            createdIds.Clear();
            foreach (var item in dto.Items)
            {
                var stockBF = new StockBF
                {
                    Id = Guid.NewGuid(),
                    BFNo = sharedBFNo,
                    BFDate = bfDateUtc,
                    OutletId = dto.OutletId,
                    ProductId = item.ProductId,
                    Quantity = item.Quantity,
                    Status = shouldAutoApprove ? StockBFStatus.Approved : StockBFStatus.Pending,
                    ClientMutationId = string.IsNullOrWhiteSpace(dto.ClientMutationId) ? null : dto.ClientMutationId.Trim(),
                    CreatedById = userId,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                if (shouldAutoApprove)
                {
                    stockBF.ApprovedById = userId;
                    stockBF.ApprovedDate = now;
                }
                _context.StockBFs.Add(stockBF);
                createdIds.Add(stockBF.Id);
            }

            await _context.SaveChangesAsync(cancellationToken);
        }

        // Retrieve all created records
        var createdRecords = await _context.StockBFs
            .Include(s => s.Outlet)
            .Include(s => s.Product)
            .Include(s => s.CreatedBy)
            .Include(s => s.UpdatedBy)
            .Include(s => s.ApprovedBy)
            .Include(s => s.RejectedBy)
            .Where(s => createdIds.Contains(s.Id))
            .ToListAsync(cancellationToken);

        if (shouldAutoApprove)
        {
            foreach (var record in createdRecords)
            {
                try
                {
                    await ApplyOpeningStockAsync(record, userId, cancellationToken);
                }
                catch
                {
                    /* Opening stock apply can be retried; BF rows must remain in approvals. */
                }
            }
        }

        return _mapper.Map<List<StockBFDetailDto>>(createdRecords);
    }

    private async Task ApplyOpeningStockAsync(StockBF stockBF, Guid userId, CancellationToken cancellationToken)
    {
        var product = await _context.Products
            .Include(p => p.ProductionSectionRef)
            .FirstOrDefaultAsync(p => p.Id == stockBF.ProductId, cancellationToken);

        if (product?.ProductionSectionRef == null)
            return;

        await _freezerStockService.SetStockAsync(new AdjustFreezerStockDto
        {
            ProductId = stockBF.ProductId,
            ProductionSectionId = product.ProductionSectionRef.Id,
            Quantity = stockBF.Quantity,
            TransactionType = "OpeningBalance",
            Reason = $"Stock BF auto-approved for outlet {stockBF.OutletId}",
            ReferenceNo = stockBF.BFNo
        }, userId, cancellationToken);
    }

    private async Task<string> GenerateNextStockBFNoAsync(CancellationToken cancellationToken)
    {
        var prefix = "SBFN";

        var lastBF = await _context.StockBFs
            .Where(s => s.BFNo.StartsWith(prefix))
            .OrderByDescending(s => s.BFNo)
            .FirstOrDefaultAsync(cancellationToken);

        var lastNumber = 0;
        if (lastBF != null && int.TryParse(lastBF.BFNo.Substring(prefix.Length), out var dbNumber))
        {
            lastNumber = dbNumber;
        }

        var nextNumber = lastNumber + 1;
        return $"{prefix}{nextNumber:D8}";
    }

    public async Task<StockBFDetailDto?> UpdateAsync(
        Guid id,
        UpdateStockBFDto dto,
        Guid userId,
        bool viewAllRecords,
        bool relaxedBfDateRules,
        CancellationToken cancellationToken = default)
    {
        var stockBF = await _context.StockBFs
            .FirstOrDefaultAsync(s => s.Id == id && s.IsActive, cancellationToken);

        if (stockBF == null)
            return null;

        if (!viewAllRecords && stockBF.CreatedById != userId)
            return null;

        if (stockBF.Status != StockBFStatus.Pending)
            throw new InvalidOperationException("Only pending Stock BF records can be updated");

        var bfDateUtc = CanonicalBfDateUtc(dto.BFDate);
        ValidateBfDateRules(dto.BFDate, relaxedBfDateRules);

        var existing = await _context.StockBFs
            .FirstOrDefaultAsync(s => s.Id != id &&
                                     s.OutletId == dto.OutletId &&
                                     s.BFDate >= EnsureUtc(dto.BFDate).Date &&
                                     s.BFDate < EnsureUtc(dto.BFDate).Date.AddDays(1) &&
                                     s.ProductId == dto.ProductId &&
                                     s.IsActive &&
                                     s.Status != StockBFStatus.Rejected,
                                cancellationToken);

        if (existing != null)
            throw new InvalidOperationException("Stock BF already exists for this outlet, date, and product combination");

        await ValidateProductsDisplayInPosAsync(new[] { dto.ProductId }, cancellationToken);

        stockBF.BFDate = bfDateUtc;
        stockBF.OutletId = dto.OutletId;
        stockBF.ProductId = dto.ProductId;
        stockBF.Quantity = dto.Quantity;
        stockBF.UpdatedById = userId;
        stockBF.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(id, userId, viewAllRecords, cancellationToken);
    }

    public async Task<StockBFDetailDto?> SubmitAsync(
        Guid id,
        Guid userId,
        bool viewAllRecords,
        CancellationToken cancellationToken = default)
    {
        // DEPRECATED: Auto-approval system eliminates the need for manual submission.
        // Entries are now created directly in Pending or Approved status.
        await Task.CompletedTask; // Suppress async warning
        throw new InvalidOperationException("Submit is deprecated. Entries are auto-approved or created in Pending status.");
    }

    public async Task<StockBFDetailDto?> ApproveAsync(Guid id, Guid approverUserId, CancellationToken cancellationToken = default)
    {
        var stockBF = await _context.StockBFs
            .Include(s => s.Product)
            .FirstOrDefaultAsync(s => s.Id == id && s.IsActive, cancellationToken);

        if (stockBF == null)
            return null;

        if (stockBF.Status == StockBFStatus.Approved)
            throw new InvalidOperationException("This Stock BF record has already been approved.");

        if (stockBF.Status != StockBFStatus.Pending)
            throw new InvalidOperationException("Only pending Stock BF records can be approved");

        // Find all items with the same BF Number (same bulk submission)
        var groupItems = await _context.StockBFs
            .Include(s => s.Product)
            .Where(s => s.IsActive && 
                       s.BFNo == stockBF.BFNo &&
                       s.Status == StockBFStatus.Pending)
            .ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;
        
        // Approve all items in the group
        foreach (var item in groupItems)
        {
            item.Status = StockBFStatus.Approved;
            item.ApprovedById = approverUserId;
            item.ApprovedDate = now;
            item.RejectedById = null;
            item.RejectedDate = null;
            item.UpdatedById = approverUserId;
            item.UpdatedAt = now;

            // Update FreezerStock for each item
            var productionSection = await _context.ProductionSections
                .FirstOrDefaultAsync(ps => ps.IsActive &&
                    item.Product != null &&
                    item.Product.ProductionSection != null &&
                    ps.Name == item.Product.ProductionSection,
                    cancellationToken);

            if (productionSection != null)
            {
                await _freezerStockService.SetStockAsync(new AdjustFreezerStockDto
                {
                    ProductId = item.ProductId,
                    ProductionSectionId = productionSection.Id,
                    Quantity = item.Quantity,
                    TransactionType = "OpeningBalance",
                    Reason = $"Stock BF approved for outlet {item.OutletId}",
                    ReferenceNo = item.BFNo
                }, approverUserId, cancellationToken);
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(id, approverUserId, viewAllRecords: false, cancellationToken, ignoreOwnership: true);
    }

    public async Task<StockBFDetailDto?> RejectAsync(Guid id, Guid rejectorUserId, CancellationToken cancellationToken = default)
    {
        var stockBF = await _context.StockBFs
            .FirstOrDefaultAsync(s => s.Id == id && s.IsActive, cancellationToken);

        if (stockBF == null)
            return null;

        if (stockBF.Status != StockBFStatus.Pending)
            throw new InvalidOperationException("Only pending Stock BF records can be rejected");

        // Find all items with the same BF Number (same bulk submission)
        var groupItems = await _context.StockBFs
            .Where(s => s.IsActive && 
                       s.BFNo == stockBF.BFNo &&
                       s.Status == StockBFStatus.Pending)
            .ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;
        
        // Reject all items in the group
        foreach (var item in groupItems)
        {
            item.Status = StockBFStatus.Rejected;
            item.RejectedById = rejectorUserId;
            item.RejectedDate = now;
            item.ApprovedById = null;
            item.ApprovedDate = null;
            item.UpdatedById = rejectorUserId;
            item.UpdatedAt = now;
        }

        await _context.SaveChangesAsync(cancellationToken);

        await ReleaseRejectedUniqueSlotsAsync(
            stockBF.OutletId,
            stockBF.BFDate,
            groupItems.Select(i => i.ProductId),
            cancellationToken);

        return await GetByIdAsync(id, rejectorUserId, viewAllRecords: false, cancellationToken, ignoreOwnership: true);
    }

    public async Task<bool> DeleteAsync(
        Guid id,
        Guid requestingUserId,
        bool viewAllRecords,
        CancellationToken cancellationToken = default)
    {
        var stockBF = await _context.StockBFs
            .FirstOrDefaultAsync(s => s.Id == id && s.IsActive, cancellationToken);

        if (stockBF == null)
            return false;

        if (!viewAllRecords && stockBF.CreatedById != requestingUserId)
            return false;

        if (stockBF.Status != StockBFStatus.Pending)
            throw new InvalidOperationException("Only pending Stock BF records can be deleted");

        stockBF.IsActive = false;
        stockBF.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return true;
    }
}
