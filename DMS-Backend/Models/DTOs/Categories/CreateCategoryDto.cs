namespace DMS_Backend.Models.DTOs.Categories;

public class CreateCategoryDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool DisplayInPOS { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}
