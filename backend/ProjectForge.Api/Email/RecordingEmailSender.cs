using System.Collections.Concurrent;

namespace ProjectForge.Api.Email;

public sealed record RecordedEmail(
    string Recipient,
    string Subject,
    string TextBody,
    string HtmlBody);

public sealed class RecordingEmailSender : IAppEmailSender
{
    private readonly ConcurrentQueue<RecordedEmail> _messages = new();

    public IReadOnlyList<RecordedEmail> Messages => _messages.ToArray();

    public Task SendAsync(
        string recipient,
        string subject,
        string textBody,
        string htmlBody,
        CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        _messages.Enqueue(new RecordedEmail(
            recipient,
            subject,
            textBody,
            htmlBody));

        return Task.CompletedTask;
    }
}