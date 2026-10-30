using Microsoft.EntityFrameworkCore;
using AutoMapper;
using DMS_Backend.Data;
using DMS_Backend.Models.Entities;
using DMS_Backend.Models.DTOs.ShowroomLabelRequest;
using DMS_Backend.Models.DTOs.OperationApprovals;
using DMS_Backend.Services.Interfaces;

namespace DMS_Backend.Services.Implementations;

public class ShowroomLabelRequestService : IShowroomLabelRequestService
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly IOperationApprovalRecorder _approvalRecorder;

    public ShowroomLabelRequestService(ApplicationDbContext context, IMapper mapper, IOperationApprovalRecorder approvalRecorder)
    {
        _context = context;
        _mapper = mapper;
        _approvalRecorder = approvalRecorder;
    }

    public async Task<List<ShowroomLabelRequestListDto>> GetAllAsync(
        int page = 1,
        int pageSize = 10,
        Guid? outletId = null,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.ShowroomLabelRequests
            .Include(r => r.Outlet)
            .Include(r => r.UpdatedBy)
            .Include(r => r.ApprovedBy)
            .Include(r => r.RejectedBy)
            .Where(r => r.IsActive)
            .AsQueryable();

        if (outletId.HasValue)
            query = query.Where(r => r.OutletId == outletId.Value);

        if (fromDate.HasValue)
            query = query.Where(r => r.RequestDate >= fromDate.Value);

        if (toDate.HasValue)
            query = query.Where(r => r.RequestDate <= toDate.Value);

        var requests = await query
            .OrderByDescending(r => r.RequestDate)
            .ThenByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return _mapper.Map<List<ShowroomLabelRequestListDto>>(requests);
    }

    public async Task<ShowroomLabelRequestDetailDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var request = await _context.ShowroomLabelRequests
            .Include(r => r.Outlet)
            .Include(r => r.CreatedBy)
            .Include(r => r.UpdatedBy)
            .Include(r => r.ApprovedBy)
            .Include(r => r.RejectedBy)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (request == null)
            return null;

        return _mapper.Map<ShowroomLabelRequestDetailDto>(request);
    }

    public async Task<ShowroomLabelRequestDetailDto> CreateAsync(
        CreateShowroomLabelRequestDto dto,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        // Validate outlet exists
        var outlet = await _context.Outlets
            .FirstOrDefaultAsync(o => o.Id == dto.OutletId && o.IsActive, cancellationToken);

        if (outlet == null)
            throw new InvalidOperationException("Outlet not found or is inactive");

        var request = new ShowroomLabelRequest
        {
            Id = Guid.NewGuid(),
            OutletId = dto.OutletId,
            Text1 = outlet.Code.Trim(),
            Text2 = null,
            LabelCount = dto.LabelCount,
            RequestDate = DateTime.UtcNow,
            Status = "Pending",
            IsActive = true,
            CreatedById = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedById = userId,
            UpdatedAt = DateTime.UtcNow
        };

        _context.ShowroomLabelRequests.Add(request);
        await _context.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(request.Id, cancellationToken)
            ?? throw new InvalidOperationException("Failed to retrieve created showroom label request");
    }

    public async Task<ShowroomLabelRequestDetailDto?> UpdateAsync(
        Guid id,
        UpdateShowroomLabelRequestDto dto,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var request = await _context.ShowroomLabelRequests
            .FirstOrDefaultAsync(r => r.Id == id && r.IsActive, cancellationToken);

        if (request == null)
            return null;

        // Only allow editing if status is Pending
        if (request.Status != "Pending")
            throw new InvalidOperationException("Only pending requests can be edited");

        // Validate outlet exists
        var outlet = await _context.Outlets
            .FirstOrDefaultAsync(o => o.Id == dto.OutletId && o.IsActive, cancellationToken);

        if (outlet == null)
            throw new InvalidOperationException("Outlet not found or is inactive");

        request.OutletId = dto.OutletId;
        request.Text1 = outlet.Code.Trim();
        request.Text2 = null;
        request.LabelCount = dto.LabelCount;
        request.UpdatedById = userId;
        request.UpdatedAt = DateTime.UtcNow;

        _context.ShowroomLabelRequests.Update(request);
        await _context.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(request.Id, cancellationToken);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var request = await _context.ShowroomLabelRequests
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (request == null)
            return false;

        request.IsActive = false;
        request.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return true;
    }

    public async Task<bool> ApproveAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
    {
        var request = await _context.ShowroomLabelRequests
            .FirstOrDefaultAsync(r => r.Id == id && r.IsActive, cancellationToken);

        if (request == null || request.Status != "Pending")
            return false;

        request.Status = "Approved";
        request.ApprovedById = userId;
        request.ApprovedDate = DateTime.UtcNow;
        request.UpdatedById = userId;
        request.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _approvalRecorder.RecordTransitionAsync(new CreateOperationApprovalDto
        {
            DocumentType = "ShowroomLabelRequest",
            DocumentId   = request.Id,
            DocumentNo   = request.Text1,
            FromStatus   = "Pending",
            ToStatus     = "Approved",
            Action       = "Approved",
        }, userId, cancellationToken);

        return true;
    }

    public async Task<bool> RejectAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
    {
        var request = await _context.ShowroomLabelRequests
            .FirstOrDefaultAsync(r => r.Id == id && r.IsActive, cancellationToken);

        if (request == null || request.Status != "Pending")
            return false;

        request.Status = "Rejected";
        request.RejectedById = userId;
        request.RejectedDate = DateTime.UtcNow;
        request.UpdatedById = userId;
        request.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _approvalRecorder.RecordTransitionAsync(new CreateOperationApprovalDto
        {
            DocumentType = "ShowroomLabelRequest",
            DocumentId   = request.Id,
            DocumentNo   = request.Text1,
            FromStatus   = "Pending",
            ToStatus     = "Rejected",
            Action       = "Rejected",
        }, userId, cancellationToken);

        return true;
    }
}
