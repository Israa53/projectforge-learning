using ProjectForge.Api.Models;

namespace ProjectForge.Api.Contracts;

// A C# "record" suits a data-shaped response
public record WorkItemDto(
    Guid Id,
    string Title,
    string Description,
    WorkStatus Status,
    Priority Priority,
    DateOnly? DueDate,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    Guid Version
)
{
    // "From" it maps the database entity to that response
    public static WorkItemDto From(WorkItem item)
    {
        return new WorkItemDto(
            item.Id,
            item.Title,
            item.Description,
            item.Status,
            item.Priority,
            item.DueDate,
            item.CreatedAt,
            item.UpdatedAt,
            item.Version
        );
    }
}