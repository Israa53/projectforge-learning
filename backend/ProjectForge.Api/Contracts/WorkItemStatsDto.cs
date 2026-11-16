namespace ProjectForge.Api.Contracts;

public sealed record WorkItemStatsDto(
    int Total,
    int Backlog,
    int InProgress,
    int Done
);