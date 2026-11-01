using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using ProjectForge.Api.Data;
using ProjectForge.Api.Models;

namespace ProjectForge.Api.Tests;

public sealed class TestDatabase : IAsyncDisposable
{
    public const string UserA = "user-a";
    public const string UserB = "user-b";

    private readonly SqliteConnection _connection;

    private readonly DbContextOptions<AppDbContext> _options;

    private TestDatabase(SqliteConnection connection)
    {
        _connection = connection;

        _options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(connection)
            .Options;
    }

    public AppDbContext CreateContext()
    {
        return new AppDbContext(_options);
    }

    public static async Task<TestDatabase> CreateAsync()
    {
        var connection = new SqliteConnection(
            "Data Source=:memory:"
        );

        var database = new TestDatabase(connection);

        try
        {
            await connection.OpenAsync();

            await using var db = database.CreateContext();

            await db.Database.EnsureCreatedAsync();

            db.Users.AddRange(
                new ApplicationUser
                {
                    Id = UserA,
                    UserName = "a@example.test",
                    Email = "a@example.test",
                    NormalizedUserName = "A@EXAMPLE.TEST",
                    NormalizedEmail = "A@EXAMPLE.TEST"
                },
                new ApplicationUser
                {
                    Id = UserB,
                    UserName = "b@example.test",
                    Email = "b@example.test",
                    NormalizedUserName = "B@EXAMPLE.TEST",
                    NormalizedEmail = "B@EXAMPLE.TEST"
                }
            );

            await db.SaveChangesAsync();

            return database;
        }
        catch
        {
            await database.DisposeAsync();
            throw;
        }
    }

    public ValueTask DisposeAsync()
    {
        return _connection.DisposeAsync();
    }
}