using System.ComponentModel.DataAnnotations;
using ProjectForge.Api.Models;

namespace ProjectForge.Api.Contracts;

public class ListQuery
{
    [StringLength(120)]
    public string? Search { get; set; }

    [EnumDataType(typeof(WorkStatus))]
    public WorkStatus? Status { get; set; }

    [Range(1, 1000000)]
    public int Page { get; set; } = 1;

    [Range(1, 50)]
    public int PageSize { get; set; } = 6;
}