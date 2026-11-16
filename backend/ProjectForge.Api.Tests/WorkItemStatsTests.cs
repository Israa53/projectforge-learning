using ProjectForge.Api.Contracts;
using ProjectForge.Api.Models;
using ProjectForge.Api.Services;
using Xunit;

namespace ProjectForge.Api.Tests;

public class WorkItemStatsTests
{
    [Fact]
    public async Task Counts_each_status_for_the_current_user_only()
    {
        await using var database = await TestDatabase.CreateAsync();
        await using var db = database.CreateContext();

        db.WorkItems.AddRange(
            new WorkItem
            {
                OwnerId = TestDatabase.UserA,
                Title = "First backlog item",
                Status = WorkStatus.Backlog
            },
            new WorkItem
            {
                OwnerId = TestDatabase.UserA,
                Title = "Second backlog item",
                Status = WorkStatus.Backlog
            },
            new WorkItem
            {
                OwnerId = TestDatabase.UserA,
                Title = "Active item",
                Status = WorkStatus.InProgress
            },
            new WorkItem
            {
                OwnerId = TestDatabase.UserA,
                Title = "Completed item",
                Status = WorkStatus.Done
            },
            new WorkItem
            {
                OwnerId = TestDatabase.UserB,
                Title = "Another user's completed item",
                Status = WorkStatus.Done
            }
        );

        await db.SaveChangesAsync();

        var service = new WorkItemService(db);

        var result = await service.GetStatsAsync(
            TestDatabase.UserA,
            CancellationToken.None
        );

        Assert.Equal(
            new WorkItemStatsDto(4, 2, 1, 1),
            result
        );
    }

    [Fact]
    public async Task Returns_zeros_when_the_user_has_no_items()
    {
        await using var database = await TestDatabase.CreateAsync();
        await using var db = database.CreateContext();

        db.WorkItems.Add(new WorkItem
        {
            OwnerId = TestDatabase.UserB,
            Title = "Another user's item",
            Status = WorkStatus.Done
        });

        await db.SaveChangesAsync();

        var service = new WorkItemService(db);

        var result = await service.GetStatsAsync(
            TestDatabase.UserA,
            CancellationToken.None
        );

        Assert.Equal(
            new WorkItemStatsDto(0, 0, 0, 0),
            result
        );
    }
}