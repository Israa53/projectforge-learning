using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using ProjectForge.Api.Models;

namespace ProjectForge.Api.Email;

public sealed class AccountEmailService(
    UserManager<ApplicationUser> users,
    IAppEmailSender sender,
    IConfiguration configuration,
    ILogger<AccountEmailService> logger)
{
    public async Task<bool> SendConfirmationAsync(
        ApplicationUser user,
        CancellationToken ct)
    {
        var token = await users.GenerateEmailConfirmationTokenAsync(user);

        var code = WebEncoders.Base64UrlEncode(
            Encoding.UTF8.GetBytes(token));

        var frontend = new Uri(
            configuration["Frontend:BaseUrl"]
                ?? "https://localhost:5173",
            UriKind.Absolute);

        var pageUrl = new Uri(frontend, "/confirm-email").AbsoluteUri;

        var parameters = QueryHelpers.AddQueryString(
            "",
            new Dictionary<string, string?>
            {
                ["userId"] = user.Id,
                ["code"] = code
            }).TrimStart('?');

        // The fragment is read by React; it isn't sent with the page request.
        var link = $"{pageUrl}#{parameters}";
        var safeLink = HtmlEncoder.Default.Encode(link);

        try
        {
            await sender.SendAsync(
                user.Email!,
                "Confirm your ProjectForge email",
                $"Confirm your email by opening this link:\n\n{link}",
                $"""
                <h1>Welcome to ProjectForge</h1>
                <p>Confirm your email address to finish setting up your account.</p>
                <p><a href="{safeLink}">Confirm email address</a></p>
                <p>If you didn't create this account, ignore this message.</p>
                """,
                ct);

            return true;
        }
        catch (Exception exception)
            when (exception is not OperationCanceledException)
        {
            logger.LogError(
                exception,
                "Unable to deliver an account-confirmation email.");

            return false;
        }
    }
}