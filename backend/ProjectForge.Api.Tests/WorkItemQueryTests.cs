using ProjectForge.Api.Contracts;
using ProjectForge.Api.Data;
using ProjectForge.Api.Models;
using ProjectForge.Api.Services;
using Xunit;

namespace ProjectForge.Api.Tests;

public class WorkItemQueryTests
{
    private static readonly CancellationToken Ct =
        CancellationToken.None;

    private static Guid ItemId(int number) =>
        Guid.Parse(
            $"00000000-0000-0000-0000-{number:D12}"
        );

    private static async Task SeedAsync(AppDbContext db)
    {
        var rows = new[]
        {
            (
                1, TestDatabase.UserA,
                "Invoice editor", "Draft",
                WorkStatus.Backlog
            ),
            (
                2, TestDatabase.UserA,
                "Address form", "Merchant invoice address",
                WorkStatus.Done
            ),
            (
                3, TestDatabase.UserA,
                "Invoice validation", "Email checks",
                WorkStatus.Done
            ),
            (
                4, TestDatabase.UserA,
                "Reports", "Metrics",
                WorkStatus.Backlog
            ),
            (
                5, TestDatabase.UserA,
                "Review tasks", "Planning",
                WorkStatus.Done
            ),
            (
                6, TestDatabase.UserB,
                "Invoice private", "Other account",
                WorkStatus.Done
            )
        };

        // Equal timestamps deliberately test the ID tie-breaker.
        var sameTime = new DateTime(
            2026, 1, 1, 12, 0, 0,
            DateTimeKind.Utc
        );

        foreach (
            var (number, owner, title, description, status)
            in rows
        )
        {
            db.WorkItems.Add(new WorkItem
            {
                Id = ItemId(number),
                OwnerId = owner,
                Title = title,
                Description = description,
                Status = status,
                Priority = Priority.Medium,
                CreatedAt = sameTime,
                UpdatedAt = sameTime
            });
        }

        await db.SaveChangesAsync();
    }

    [Theory]
    [InlineData(1, new int[] { 1, 2 })]
    [InlineData(2, new int[] { 3, 4 })]
    [InlineData(3, new int[] { 5 })]
    [InlineData(4, new int[] { })]
    public async Task Pagination_returns_stable_pages_and_total_count(
        int page,
        int[] expectedNumbers)
    {
        await using var database =
            await TestDatabase.CreateAsync();

        await using var db = database.CreateContext();

        await SeedAsync(db);

        var result =
            await new WorkItemService(db).GetAllAsync(
                TestDatabase.UserA,
                new ListQuery
                {
                    Page = page,
                    PageSize = 2
                },
                Ct
            );

        Assert.Equal(5, result.TotalCount);
        Assert.Equal(page, result.Page);
        Assert.Equal(2, result.PageSize);

        Assert.Equal(
            expectedNumbers.Select(ItemId).ToArray(),
            result.Items
                .Select(item => item.Id)
                .ToArray()
        );
    }

    [Theory]
    [InlineData(1, 2)]
    [InlineData(2, 3)]
    public async Task Search_and_status_filter_before_counting_and_paging(
        int page,
        int expectedNumber)
    {
        await using var database =
            await TestDatabase.CreateAsync();

        await using var db = database.CreateContext();

        await SeedAsync(db);

        var result =
            await new WorkItemService(db).GetAllAsync(
                TestDatabase.UserA,
                new ListQuery
                {
                    Search = "  INVOICE  ",
                    Status = WorkStatus.Done,
                    Page = page,
                    PageSize = 1
                },
                Ct
            );

        Assert.Equal(2, result.TotalCount);

        var item = Assert.Single(result.Items);

        Assert.Equal(
            ItemId(expectedNumber),
            item.Id
        );
    }
}