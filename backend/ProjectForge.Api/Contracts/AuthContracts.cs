using System.ComponentModel.DataAnnotations;
namespace ProjectForge.Api.Contracts;

public class LoginInput
{
    [Required, EmailAddress, StringLength(254)]
    public string Email { get; set; } = "";

    [Required, StringLength(128)]
    public string Password { get; set; } = "";
}

public record AuthUserDto(string Id, string Email);

public record AuthResponse(
    string TokenType,
    string AccessToken,
    int ExpiresIn,
    AuthUserDto User
);
