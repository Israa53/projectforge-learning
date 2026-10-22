using System.ComponentModel.DataAnnotations;

namespace ProjectForge.Api.Contracts;

public class RegisterInput
{
    [Required]
    [EmailAddress]
    [StringLength(254)]
    public string Email { get; set; } = "";

    [Required]
    [StringLength(128, MinimumLength = 12)]
    public string Password { get; set; } = "";
}