using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ProjectForge.Api.Auth;
using ProjectForge.Api.Contracts;
using ProjectForge.Api.Models;
using ProjectForge.Api.Email;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;
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
    IAntiforgery antiforgery,
    AccountEmailService accountEmails) : ControllerBase
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
    [HttpPost("test-email")]
    public async Task<IActionResult> TestEmail(
        [FromHeader(Name = "X-CSRF-TOKEN")] string csrfToken,
        [FromServices] IWebHostEnvironment environment,
        [FromServices] IAppEmailSender emailSender,
        CancellationToken ct)
    {
        if (!environment.IsDevelopment())
        {
            return NotFound();
        }

        if (!await antiforgery.IsRequestValidAsync(HttpContext))
        {
            return CsrfError();
        }

        await emailSender.SendAsync(
            recipient: "learning@projectforge.test",
            subject: "ProjectForge email delivery works",
            textBody: "Your ASP.NET backend successfully sent this email.",
            htmlBody: """
            <h1>Hello from ProjectForge!</h1>
            <p>Your ASP.NET backend successfully sent this email.</p>
            <p>Next: email confirmation and password reset.</p>
            """,
            ct: ct);

        return Ok(new { message = "Test email sent to Mailpit." });
    }

    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<IActionResult> Register(
    RegisterInput input,
    [FromHeader(Name = "X-CSRF-TOKEN")] string csrfToken,
    CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(HttpContext))
            return CsrfError();

        var email = input.Email.Trim();
        var user = new ApplicationUser
        {
            UserName = email,
            Email = email
        };

        var result = await users.CreateAsync(user, input.Password);

        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
                ModelState.AddModelError("registration", error.Description);

            return ValidationProblem(ModelState);
        }

        var sent = await accountEmails.SendConfirmationAsync(user, ct);

        return StatusCode(201, new
        {
            message = sent
                ? "Account created. Check your email to confirm your address."
                : "Account created, but email delivery failed. Request another confirmation email.",
            confirmationEmailSent = sent
        });
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
    [AllowAnonymous]
    [HttpPost("confirm-email")]
    public async Task<IActionResult> ConfirmEmail(
        EmailConfirmationInput input,
        [FromHeader(Name = "X-CSRF-TOKEN")] string csrfToken)
    {
        if (!await antiforgery.IsRequestValidAsync(HttpContext))
            return CsrfError();

        var user = await users.FindByIdAsync(input.UserId);

        if (user is null)
            return InvalidConfirmation();

        string token;

        try
        {
            token = Encoding.UTF8.GetString(
                WebEncoders.Base64UrlDecode(input.Code));
        }
        catch (FormatException)
        {
            return InvalidConfirmation();
        }

        var result = await users.ConfirmEmailAsync(user, token);

        return result.Succeeded
            ? Ok(new { message = "Email confirmed successfully." })
            : InvalidConfirmation();
    }

    [AllowAnonymous]
    [HttpPost("resend-confirmation")]
    public async Task<IActionResult> ResendConfirmation(
        ResendConfirmationInput input,
        [FromHeader(Name = "X-CSRF-TOKEN")] string csrfToken,
        CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(HttpContext))
            return CsrfError();

        var user = await users.FindByEmailAsync(input.Email.Trim());

        if (user is not null && !await users.IsEmailConfirmedAsync(user))
        {
            await accountEmails.SendConfirmationAsync(user, ct);
        }

        return Accepted(new
        {
            message =
                "If the account needs confirmation, a confirmation email will be sent."
        });
    }

    private ObjectResult InvalidConfirmation() => Problem(
        statusCode: 400,
        title: "Invalid confirmation link",
        detail: "This confirmation link is invalid or expired. Request a new one.");

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
