using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using ProjectForge.Api.Data;
using ProjectForge.Api.Models;

namespace ProjectForge.Api.Tests.Http;

public sealed class TestApiFactory : WebApplicationFactory<Program>
{
    private readonly bool _useTestAuthentication;
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly string _signingKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

    public TestApiFactory(bool useTestAuthentication = true)
    {
        _useTestAuthentication = useTestAuthentication;
        _connection.Open();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<AppDbContext>();
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<AppDbContext>>();
            services.AddDbContext<AppDbContext>(options => options.UseSqlite(_connection));

            if (_useTestAuthentication)
            {
                services.AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                    options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
                }).AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                    TestAuthHandler.SchemeName, _ => { });
            }
        });
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        // Program reads JWT configuration before app.Build(), so supply it early.
        builder.ConfigureHostConfiguration(configuration =>
            configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:SigningKey"] = _signingKey,
                ["ConnectionStrings:Database"] = "Data Source=:memory:"
            }));

        var host = base.CreateHost(builder);
        using var scope = host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Database.EnsureCreated();
        db.Users.AddRange(
            new ApplicationUser { Id = TestDatabase.UserA, UserName = "a@example.test", Email = "a@example.test" },
            new ApplicationUser { Id = TestDatabase.UserB, UserName = "b@example.test", Email = "b@example.test" });
        db.SaveChanges();
        return host;
    }

    public HttpClient CreateApiClient(string? userId = null, bool handleCookies = true)
    {
        if (userId is not null && !_useTestAuthentication)
            throw new InvalidOperationException("Use bearer tokens with real authentication.");

        var client = CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false,
            HandleCookies = handleCookies
        });
        if (userId is not null)
            client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeader, userId);
        return client;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing) _connection.Dispose();
    }
}
