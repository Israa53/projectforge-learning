namespace ProjectForge.Api.Models;

public enum WorkStatus
{
    Backlog,
    InProgress,
    Done
}

public enum Priority
{
    Low,
    Medium,
    High
}

public class WorkItem
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Title { get; set; } = "";

    public string Description { get; set; } = "";

    public WorkStatus Status { get; set; } = WorkStatus.Backlog;

    public Priority Priority { get; set; } = Priority.Medium;

    public DateOnly? DueDate { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Guid Version { get; set; } = Guid.NewGuid();
}