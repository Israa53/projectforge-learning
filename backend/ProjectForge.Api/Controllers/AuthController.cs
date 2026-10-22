using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ProjectForge.Api.Auth;
using ProjectForge.Api.Contracts;
using ProjectForge.Api.Models;

namespace ProjectForge.Api.Controllers;

[ApiController]
[Route("api/auth")]
[RequireHttps]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
[EnableRateLimiting("auth")]
public class AuthController(
    UserManager<ApplicationUser> users,
    SignInManager<ApplicationUser> signIn,
    AuthSessionService sessions,
    IAntiforgery antiforgery) : ControllerBase
{
    private const string CookieName = "__Secure-projectforge.refresh";

    [AllowAnonymous]
    [HttpGet("csrf")]
    public IActionResult Csrf()
    {
        var tokens = antiforgery.GetAndStoreTokens(HttpContext);
        return Ok(new { requestToken = tokens.RequestToken });
    }

    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<IActionResult> Register(
        RegisterInput input,
        [FromHeader(Name = "X-CSRF-TOKEN")] string csrfToken)
    {
        if (!await antiforgery.IsRequestValidAsync(HttpContext)) return CsrfError();

        var email = input.Email.Trim();
        var user = new ApplicationUser { UserName = email, Email = email };
        var result = await users.CreateAsync(user, input.Password);

        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
                ModelState.AddModelError("registration", error.Description);

            return ValidationProblem(ModelState);
        }

        return StatusCode(201, new { message = "Account created successfully." });
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(
        LoginInput input,
        [FromHeader(Name = "X-CSRF-TOKEN")] string csrfToken,
        CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(HttpContext)) return CsrfError();

        var user = await users.FindByEmailAsync(input.Email.Trim());
        if (user is null) return InvalidLogin();

        var result = await signIn.CheckPasswordSignInAsync(
            user, input.Password, lockoutOnFailure: true);

        if (!result.Succeeded) return InvalidLogin();

        var tokens = await sessions.StartAsync(user, ct);
        SetRefreshCookie(tokens);
        return Ok(tokens.Response);
    }

    [AllowAnonymous]
    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> Refresh(
        [FromHeader(Name = "X-CSRF-TOKEN")] string csrfToken,
        CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(HttpContext)) return CsrfError();

        var raw = Request.Cookies[CookieName];
        if (string.IsNullOrEmpty(raw)) return InvalidSession();

        var tokens = await sessions.RotateAsync(raw, ct);
        if (tokens is null)
        {
            Response.Cookies.Delete(CookieName, RefreshCookieOptions());
            return InvalidSession();
        }

        SetRefreshCookie(tokens);
        return Ok(tokens.Response);
    }

    [AllowAnonymous]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(
        [FromHeader(Name = "X-CSRF-TOKEN")] string csrfToken,
        CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(HttpContext)) return CsrfError();

        var raw = Request.Cookies[CookieName];
        if (!string.IsNullOrEmpty(raw)) await sessions.RevokeAsync(raw, ct);

        Response.Cookies.Delete(CookieName, RefreshCookieOptions());
        return NoContent();
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<AuthUserDto>> Me()
    {
        var id = User.FindFirstValue("sub");
        var user = id is null ? null : await users.FindByIdAsync(id);
        return user is null
            ? Unauthorized()
            : Ok(new AuthUserDto(user.Id, user.Email ?? ""));
    }

    private void SetRefreshCookie(SessionTokens tokens)
    {
        var options = RefreshCookieOptions();
        options.Expires = new DateTimeOffset(tokens.RefreshExpiresAtUtc);
        Response.Cookies.Append(CookieName, tokens.RefreshToken, options);
    }

    private static CookieOptions RefreshCookieOptions() => new()
    {
        HttpOnly = true,
        Secure = true,
        SameSite = SameSiteMode.Strict,
        Path = "/api/auth",
        IsEssential = true
    };

    private ObjectResult CsrfError() => Problem(statusCode: 400,
        title: "Invalid CSRF token", detail: "Get /api/auth/csrf and send its requestToken in the X-CSRF-TOKEN header.");

    private ObjectResult InvalidLogin() => Problem(statusCode: 401,
        title: "Login failed", detail: "Invalid email or password, or the account cannot sign in.");

    private ObjectResult InvalidSession() => Problem(statusCode: 401,
        title: "Session expired", detail: "Please sign in again.");
}
