using System.ComponentModel.DataAnnotations;

namespace DMS_Backend.Models.DTOs.ShowroomLabelRequest;

public sealed class UpdateShowroomLabelRequestDto
{
    [Required(ErrorMessage = "Outlet ID is required")]
    public required Guid OutletId { get; set; }

    [Required(ErrorMessage = "Label count is required")]
    [Range(1, 1000, ErrorMessage = "Label count must be between 1 and 1000")]
    public required int LabelCount { get; set; }
}
