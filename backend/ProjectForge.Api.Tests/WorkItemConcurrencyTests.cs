using Microsoft.EntityFrameworkCore;
using ProjectForge.Api.Contracts;
using ProjectForge.Api.Services;
using Xunit;

namespace ProjectForge.Api.Tests;

public class WorkItemConcurrencyTests
{
    private static readonly CancellationToken Ct =
        CancellationToken.None;

    private static async Task<WorkItemDto> CreateItemAsync(
        TestDatabase database)
    {
        await using var db = database.CreateContext();

        return await new WorkItemService(db).CreateAsync(
            TestDatabase.UserA,
            new WorkItemInput
            {
                Title = "Original title",
                Description = "Original details"
            },
            Ct
        );
    }

    private static UpdateWorkItemInput Edit(
        Guid version,
        string title)
    {
        return new UpdateWorkItemInput
        {
            Title = title,
            Description = "Updated details",
            Version = version
        };
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Stale_version_is_rejected(
        bool delete)
    {
        await using var database =
            await TestDatabase.CreateAsync();

        var original = await CreateItemAsync(database);

        // First writer successfully saves a newer version.
        await using var writerDb =
            database.CreateContext();

        var newer =
            await new WorkItemService(writerDb).UpdateAsync(
                TestDatabase.UserA,
                original.Id,
                Edit(original.Version, "Newer title"),
                Ct
            );

        Assert.Equal(
            WorkItemWriteStatus.Success,
            newer.Status
        );

        Assert.NotNull(newer.Item);

        Assert.NotEqual(
            original.Version,
            newer.Item!.Version
        );

        // Second writer submits the original, stale version.
        await using var staleDb =
            database.CreateContext();

        var service = new WorkItemService(staleDb);

        var status = delete
            ? await service.DeleteAsync(
                TestDatabase.UserA,
                original.Id,
                original.Version,
                Ct
            )
            : (
                await service.UpdateAsync(
                    TestDatabase.UserA,
                    original.Id,
                    Edit(
                        original.Version,
                        "Stale overwrite"
                    ),
                    Ct
                )
            ).Status;

        Assert.Equal(
            WorkItemWriteStatus.VersionConflict,
            status
        );

        // The newer data must remain unchanged.
        await using var verificationDb =
            database.CreateContext();

        var stored =
            await new WorkItemService(verificationDb)
                .GetByIdAsync(
                    TestDatabase.UserA,
                    original.Id,
                    Ct
                );

        Assert.Equal(newer.Item, stored);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Database_version_change_after_tracking_is_rejected(
        bool delete)
    {
        await using var database =
            await TestDatabase.CreateAsync();

        var original = await CreateItemAsync(database);

        // Context A reads and tracks the original row.
        await using var staleDb =
            database.CreateContext();

        var tracked = await staleDb.WorkItems
            .SingleAsync(
                item => item.Id == original.Id
            );

        // Context B changes the database after A's read.
        await using var writerDb =
            database.CreateContext();

        var newer =
            await new WorkItemService(writerDb).UpdateAsync(
                TestDatabase.UserA,
                original.Id,
                Edit(original.Version, "Newer title"),
                Ct
            );

        Assert.Equal(
            WorkItemWriteStatus.Success,
            newer.Status
        );

        Assert.NotNull(newer.Item);

        // A still holds the old tracked version.
        // EF's database-write check must catch the conflict.
        var service = new WorkItemService(staleDb);

        var status = delete
            ? await service.DeleteAsync(
                TestDatabase.UserA,
                original.Id,
                original.Version,
                Ct
            )
            : (
                await service.UpdateAsync(
                    TestDatabase.UserA,
                    original.Id,
                    Edit(
                        original.Version,
                        "Stale overwrite"
                    ),
                    Ct
                )
            ).Status;

        Assert.Equal(
            WorkItemWriteStatus.VersionConflict,
            status
        );

        Assert.Equal(
            EntityState.Detached,
            staleDb.Entry(tracked).State
        );

        await using var verificationDb =
            database.CreateContext();

        var stored =
            await new WorkItemService(verificationDb)
                .GetByIdAsync(
                    TestDatabase.UserA,
                    original.Id,
                    Ct
                );

        Assert.Equal(newer.Item, stored);
    }
}