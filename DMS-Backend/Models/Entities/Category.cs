using System.ComponentModel.DataAnnotations;

namespace DMS_Backend.Models.Entities;

public class Category : BaseEntity
{
    [Required]
    [MaxLength(20)]
    public string Code { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    public bool DisplayInPOS { get; set; } = true;

    /// <summary>POS category tab order (lower appears first).</summary>
    public int SortOrder { get; set; }

    // Navigation properties
    public ICollection<Product>? Products { get; set; }
}
