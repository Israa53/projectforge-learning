using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using ProjectForge.Api.Auth;
using ProjectForge.Api.Contracts;
using ProjectForge.Api.Data;
using Xunit;

namespace ProjectForge.Api.Tests.Http;

public class AuthHttpTests
{
    private const string Email = "auth@example.test";
    private const string Password = "LearningReact2026!";
    private const string RefreshCookie = "__Secure-projectforge.refresh";
    private const string CsrfCookie = "__Host-projectforge.csrf";

    private sealed record Session(string Csrf, AuthResponse Auth, string CookieHeader);

    private static string CookieHeader(HttpResponseMessage response, string name) =>
        response.Headers.GetValues("Set-Cookie")
            .Single(value => value.StartsWith(name + "=", StringComparison.Ordinal));

    private static async Task<string> ReadCsrfAsync(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        return json.GetProperty("requestToken").GetString()!;
    }

    private static async Task<string> GetCsrfAsync(HttpClient client)
    {
        using var response = await client.GetAsync("/api/auth/csrf");
        return await ReadCsrfAsync(response);
    }

    private static async Task<HttpResponseMessage> PostAsync(
        HttpClient client, string path, string? csrf, object? body = null,
        string? cookies = null)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, path);
        if (csrf is not null) request.Headers.Add("X-CSRF-TOKEN", csrf);
        if (cookies is not null) request.Headers.Add("Cookie", cookies);
        if (body is not null) request.Content = JsonContent.Create(body);
        return await client.SendAsync(request);
    }

    private static async Task<Session> SignInAsync(HttpClient client)
    {
        var csrf = await GetCsrfAsync(client);
        var credentials = new { email = Email, password = Password };
        using var registration = await PostAsync(client, "/api/auth/register", csrf, credentials);
        Assert.Equal(HttpStatusCode.Created, registration.StatusCode);
        using var login = await PostAsync(client, "/api/auth/login", csrf, credentials);
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var json = await login.Content.ReadFromJsonAsync<JsonElement>();
        var auth = json.Deserialize<AuthResponse>(new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.NotNull(auth);
        Assert.False(json.TryGetProperty("refreshToken", out _));
        return new Session(csrf, auth!, CookieHeader(login, RefreshCookie));
    }

    private static async Task<HttpResponseMessage> MeAsync(HttpClient client, string token)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await client.SendAsync(request);
    }

    [Fact]
    public async Task Register_login_and_me_use_real_tokens_and_secure_cookie()
    {
        using var factory = new TestApiFactory(useTestAuthentication: false);
        using var client = factory.CreateApiClient();
        var session = await SignInAsync(client);
        Assert.Equal("Bearer", session.Auth.TokenType);
        Assert.Equal(300, session.Auth.ExpiresIn);
        Assert.Equal(Email, session.Auth.User.Email);

        var attributes = session.CookieHeader.Split(';').Select(value => value.Trim()).ToArray();
        Assert.Contains(attributes, value => value.Equals("HttpOnly", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(attributes, value => value.Equals("Secure", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(attributes, value => value.Equals("SameSite=Strict", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(attributes, value => value.Equals("Path=/api/auth", StringComparison.OrdinalIgnoreCase));

        using var me = await MeAsync(client, session.Auth.AccessToken);
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        Assert.Equal(session.Auth.User, await me.Content.ReadFromJsonAsync<AuthUserDto>());

        var rawToken = attributes[0][(RefreshCookie.Length + 1)..];
        var expectedHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var credential = await db.RefreshTokens.AsNoTracking().SingleAsync();
        Assert.NotEqual(rawToken, credential.TokenHash);
        Assert.Equal(expectedHash, credential.TokenHash);
    }

    [Fact]
    public async Task Wrong_password_returns_401()
    {
        using var factory = new TestApiFactory(useTestAuthentication: false);
        using var client = factory.CreateApiClient();
        var session = await SignInAsync(client);
        using var response = await PostAsync(client, "/api/auth/login", session.Csrf,
            new { email = Email, password = "WrongPassword123!" });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("expired")]
    [InlineData("issuer")]
    [InlineData("audience")]
    [InlineData("signature")]
    public async Task Invalid_access_token_returns_401(string failure)
    {
        using var factory = new TestApiFactory(useTestAuthentication: false);
        using var client = factory.CreateApiClient();
        var session = await SignInAsync(client);
        var options = factory.Services.GetRequiredService<JwtOptions>();
        var now = DateTime.UtcNow;
        var key = failure == "signature"
            ? RandomNumberGenerator.GetBytes(64)
            : Convert.FromBase64String(options.SigningKey);

        var token = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = failure == "issuer" ? "wrong-issuer" : options.Issuer,
            Audience = failure == "audience" ? "wrong-audience" : options.Audience,
            Subject = new ClaimsIdentity(new[] { new Claim("sub", session.Auth.User.Id) }),
            IssuedAt = now.AddHours(-2),
            NotBefore = now.AddHours(-2),
            Expires = failure == "expired" ? now.AddHours(-1) : now.AddMinutes(5),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256)
        });

        using var response = await MeAsync(client, token);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/auth/register")]
    [InlineData("/api/auth/login")]
    [InlineData("/api/auth/refresh")]
    [InlineData("/api/auth/logout")]
    public async Task Invalid_csrf_returns_400(string path)
    {
        using var factory = new TestApiFactory(useTestAuthentication: false);
        using var client = factory.CreateApiClient();
        await SignInAsync(client);
        object? body = path.EndsWith("register")
            ? new { email = "second@example.test", password = Password }
            : path.EndsWith("login") ? new { email = Email, password = Password } : null;
        using var response = await PostAsync(client, path, "invalid-csrf", body);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Invalid CSRF token", problem.GetProperty("title").GetString());
    }

    [Fact]
    public async Task Refresh_rotates_cookie_and_reuse_revokes_the_session()
    {
        using var factory = new TestApiFactory(useTestAuthentication: false);
        using var client = factory.CreateApiClient();
        var session = await SignInAsync(client);
        var oldCookie = session.CookieHeader.Split(';')[0];
        using var refresh = await PostAsync(client, "/api/auth/refresh", session.Csrf);
        Assert.Equal(HttpStatusCode.OK, refresh.StatusCode);
        var newCookie = CookieHeader(refresh, RefreshCookie).Split(';')[0];
        Assert.NotEqual(oldCookie, newCookie);
        var refreshed = await refresh.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(refreshed);
        Assert.NotEqual(session.Auth.AccessToken, refreshed!.AccessToken);
        using var me = await MeAsync(client, refreshed.AccessToken);
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);

        // Separate client deliberately replays the old credential.
        using var replayClient = factory.CreateApiClient(handleCookies: false);
        using var csrfResponse = await replayClient.GetAsync("/api/auth/csrf");
        var replayCsrf = await ReadCsrfAsync(csrfResponse);
        var csrfCookie = CookieHeader(csrfResponse, CsrfCookie).Split(';')[0];
        using var replay = await PostAsync(replayClient, "/api/auth/refresh", replayCsrf,
            cookies: $"{oldCookie}; {csrfCookie}");
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);

        // The legitimate client's newer cookie must now fail too.
        using var afterReplay = await PostAsync(client, "/api/auth/refresh", session.Csrf);
        Assert.Equal(HttpStatusCode.Unauthorized, afterReplay.StatusCode);
    }

    [Fact]
    public async Task Logout_revokes_refresh_but_existing_access_token_lasts_until_expiry()
    {
        using var factory = new TestApiFactory(useTestAuthentication: false);
        using var client = factory.CreateApiClient();
        var session = await SignInAsync(client);
        using var logout = await PostAsync(client, "/api/auth/logout", session.Csrf);
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        using var refresh = await PostAsync(client, "/api/auth/refresh", session.Csrf);
        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);
        using var me = await MeAsync(client, session.Auth.AccessToken);
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
    }
}
