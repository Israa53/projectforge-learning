using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace ProjectForge.Api.Tests.Http;

public sealed class TestAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder
) : AuthenticationHandler<AuthenticationSchemeOptions>(
    options,
    logger,
    encoder
)
{
    public const string SchemeName = "Test";
    public const string UserHeader = "X-Test-User";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var userId = Request.Headers[UserHeader].ToString();

        if (string.IsNullOrWhiteSpace(userId))
        {
            return Task.FromResult(
                AuthenticateResult.NoResult()
            );
        }

        if (
            userId != TestDatabase.UserA &&
            userId != TestDatabase.UserB
        )
        {
            return Task.FromResult(
                AuthenticateResult.Fail("Unknown test user.")
            );
        }

        var identity = new ClaimsIdentity(
            new[]
            {
                new Claim("sub", userId)
            },
            SchemeName
        );

        var ticket = new AuthenticationTicket(
            new ClaimsPrincipal(identity),
            SchemeName
        );

        return Task.FromResult(
            AuthenticateResult.Success(ticket)
        );
    }
}