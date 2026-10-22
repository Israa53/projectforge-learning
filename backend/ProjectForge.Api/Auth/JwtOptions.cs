namespace ProjectForge.Api.Auth;

public class JwtOptions
{
    public string Issuer { get; set; } = "ProjectForge.Api";
    public string Audience { get; set; } = "ProjectForge.Web";
    public string SigningKey { get; set; } = "";
    public int AccessTokenMinutes { get; set; } = 5;
}
