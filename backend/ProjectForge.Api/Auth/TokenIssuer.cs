using System.Security.Claims;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using ProjectForge.Api.Contracts;
using ProjectForge.Api.Models;

namespace ProjectForge.Api.Auth;

public class TokenIssuer(JwtOptions options)
{
    private readonly SymmetricSecurityKey key = new(
        Convert.FromBase64String(options.SigningKey)
    );

    public AuthResponse Create(ApplicationUser user, Guid sessionId)
    {
        var now = DateTime.UtcNow;
        var token = new JsonWebTokenHandler().CreateToken(
            new SecurityTokenDescriptor
            {
                Issuer = options.Issuer,
                Audience = options.Audience,
                IssuedAt = now,
                NotBefore = now,
                Expires = now.AddMinutes(options.AccessTokenMinutes),
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim("sub", user.Id),
                    new Claim("email", user.Email ?? ""),
                    new Claim("sid", sessionId.ToString()),
                    new Claim("jti", Guid.NewGuid().ToString())
                }),
                SigningCredentials = new SigningCredentials(
                    key,
                    SecurityAlgorithms.HmacSha256
                )
            }
        );

        return new AuthResponse(
            "Bearer",
            token,
            options.AccessTokenMinutes * 60,
            new AuthUserDto(user.Id, user.Email ?? "")
        );
    }
}
