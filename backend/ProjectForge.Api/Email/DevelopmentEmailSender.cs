using MailKit;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace ProjectForge.Api.Email;

public sealed class DevelopmentEmailSender(
    IWebHostEnvironment environment
) : IAppEmailSender
{
    public async Task SendAsync(
        string recipient,
        string subject,
        string textBody,
        string htmlBody,
        CancellationToken ct)
    {
        if (!environment.IsDevelopment())
        {
            throw new InvalidOperationException(
                "The development email sender requires Development mode.");
        }

        var message = new MimeMessage();

        message.From.Add(
            new MailboxAddress("ProjectForge", "noreply@projectforge.test"));

        message.To.Add(MailboxAddress.Parse(recipient));
        message.Subject = subject;

        message.Body = new BodyBuilder
        {
            TextBody = textBody,
            HtmlBody = htmlBody
        }.ToMessageBody();

        using var client = new SmtpClient();

        await client.ConnectAsync(
            "127.0.0.1",
            1025,
            SecureSocketOptions.None,
            ct);

        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);
    }
}