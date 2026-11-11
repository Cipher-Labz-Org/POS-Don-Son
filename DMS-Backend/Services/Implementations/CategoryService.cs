using AutoMapper;
using DMS_Backend.Data;
using DMS_Backend.Models.DTOs.Categories;
using DMS_Backend.Models.Entities;
using DMS_Backend.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace DMS_Backend.Services.Implementations;

public class CategoryService : ICategoryService
{
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly ISystemLogService _systemLogService;

    public CategoryService(
        ApplicationDbContext context,
        IMapper mapper,
        ISystemLogService systemLogService)
    {
        _context = context;
        _mapper = mapper;
        _systemLogService = systemLogService;
    }

    public async Task<(List<CategoryListItemDto> categories, int totalCount)> GetAllAsync(
        int page,
        int pageSize,
        string? searchTerm = null,
        bool? activeOnly = null,
        bool? displayInPosOnly = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Categories
            .Include(c => c.Products)
            .AsQueryable();

        if (activeOnly == true)
        {
            query = query.Where(c => c.IsActive);
        }

        if (displayInPosOnly == true)
        {
            query = query.Where(c => c.DisplayInPOS == true);
        }

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var searchLower = searchTerm.ToLower();
            query = query.Where(c =>
                c.Code.ToLower().Contains(searchLower) ||
                c.Name.ToLower().Contains(searchLower) ||
                (c.Description != null && c.Description.ToLower().Contains(searchLower)));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var categories = await query
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .ThenBy(c => c.Code)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var categoryDtos = _mapper.Map<List<CategoryListItemDto>>(categories);

        return (categoryDtos, totalCount);
    }

    public async Task<CategoryDetailDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var category = await _context.Categories
            .Include(c => c.Products)
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

        if (category == null)
        {
            return null;
        }

        return _mapper.Map<CategoryDetailDto>(category);
    }

    public async Task<CategoryDetailDto> CreateAsync(
        CreateCategoryDto dto,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        // Check if code already exists
        if (await CodeExistsAsync(dto.Code, null, cancellationToken))
        {
            throw new InvalidOperationException($"Category with code '{dto.Code}' already exists");
        }

        var category = _mapper.Map<Category>(dto);
        category.CreatedById = userId;
        category.UpdatedById = userId;

        _context.Categories.Add(category);
        await _context.SaveChangesAsync(cancellationToken);

        await _systemLogService.LogInfoAsync("CategoryService", $"Category created: {category.Code} by user {userId}");

        return _mapper.Map<CategoryDetailDto>(category);
    }

    public async Task<CategoryDetailDto> UpdateAsync(
        Guid id,
        UpdateCategoryDto dto,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var category = await _context.Categories.FindAsync(new object[] { id }, cancellationToken);
        if (category == null)
        {
            throw new InvalidOperationException("Category not found");
        }

        // Check if code is being changed and if the new code already exists
        if (category.Code != dto.Code && await CodeExistsAsync(dto.Code, id, cancellationToken))
        {
            throw new InvalidOperationException($"Category with code '{dto.Code}' already exists");
        }

        category.Code = dto.Code;
        category.Name = dto.Name;
        category.Description = dto.Description;
        category.DisplayInPOS = dto.DisplayInPOS;
        category.IsActive = dto.IsActive;
        category.SortOrder = dto.SortOrder;
        category.UpdatedById = userId;
        category.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _systemLogService.LogInfoAsync("CategoryService", $"Category updated: {category.Code} by user {userId}");

        return _mapper.Map<CategoryDetailDto>(category);
    }

    public async Task DeleteAsync(Guid id, Guid userId, CancellationToken cancellationToken = default)
    {
        var category = await _context.Categories
            .Include(c => c.Products)
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

        if (category == null)
        {
            throw new InvalidOperationException("Category not found");
        }

        // Check if category has associated products
        if (category.Products != null && category.Products.Any(p => p.IsActive))
        {
            throw new InvalidOperationException("Cannot delete category with active products. Deactivate the category instead.");
        }

        // Soft delete
        category.IsActive = false;
        category.UpdatedById = userId;
        category.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _systemLogService.LogInfoAsync("CategoryService", $"Category soft-deleted: {category.Code} by user {userId}");
    }

    public async Task<bool> CodeExistsAsync(
        string code,
        Guid? excludeId = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Categories.Where(c => c.Code == code);

        if (excludeId.HasValue)
        {
            query = query.Where(c => c.Id != excludeId.Value);
        }

        return await query.AnyAsync(cancellationToken);
    }
}
