using System.ComponentModel.DataAnnotations;

namespace ProjectForge.Api.Contracts;

public sealed class EmailConfirmationInput
{
    [Required, StringLength(450)]
    public string UserId { get; set; } = "";

    [Required, StringLength(4096)]
    public string Code { get; set; } = "";
}

public sealed class ResendConfirmationInput
{
    [Required, EmailAddress, StringLength(254)]
    public string Email { get; set; } = "";
}