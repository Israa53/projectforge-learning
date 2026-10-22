using System.ComponentModel.DataAnnotations;
using ProjectForge.Api.Models;

namespace ProjectForge.Api.Contracts;

// Represents the input data for creating or updating a work item.
// "IValidatableObject" implementation allows custom validation logic for the work item input.

public class WorkItemInput : IValidatableObject
{
    [Required]
    [StringLength(120, MinimumLength = 3)]
    public string Title { get; set; } = "";

    [Required(AllowEmptyStrings = true)]
    [StringLength(4000)]
    public string Description { get; set; } = "";

    [EnumDataType(typeof(WorkStatus))]
    public WorkStatus Status { get; set; } = WorkStatus.Backlog;

    [EnumDataType(typeof(Priority))]
    public Priority Priority { get; set; } = Priority.Medium;

    public DateOnly? DueDate { get; set; }

    public IEnumerable<ValidationResult> Validate(
        ValidationContext validationContext)
    {
        if (Title.Trim().Length < 3)
        {
            yield return new ValidationResult(
                "Title must contain at least 3 non-padding characters.",
                new[] { nameof(Title) }
            );
        }
    }
}