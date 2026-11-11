namespace DMS_Backend.Models.DTOs.Categories;

public class UpdateCategoryDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool DisplayInPOS { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
}
