using System.ComponentModel.DataAnnotations;

namespace ProjectForge.Api.Contracts;

public class UpdateWorkItemInput : WorkItemInput
{
    [Required]
    public Guid? Version { get; set; }
}