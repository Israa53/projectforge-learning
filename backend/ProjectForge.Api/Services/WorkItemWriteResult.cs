using ProjectForge.Api.Contracts;

namespace ProjectForge.Api.Services;

public enum WorkItemWriteStatus
{
    Success,
    NotFound,
    VersionConflict
}

public sealed record WorkItemWriteResult(
    WorkItemWriteStatus Status,
    WorkItemDto? Item = null
);