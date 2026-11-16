namespace ProjectForge.Api.Email;

public interface IAppEmailSender
{
    Task SendAsync(
        string recipient,
        string subject,
        string textBody,
        string htmlBody,
        CancellationToken ct);
}