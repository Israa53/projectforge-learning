using ProjectForge.Api.Contracts;
using ProjectForge.Api.Models;
using ProjectForge.Api.Services;
using Xunit;

namespace ProjectForge.Api.Tests;

public class WorkItemOwnershipTests
{
    private static readonly CancellationToken Ct =
        CancellationToken.None;

    private static WorkItemInput NewItem(string title)
    {
        return new WorkItemInput
        {
            Title = title,
            Description = "Ownership test",
            Status = WorkStatus.Backlog,
            Priority = Priority.Medium,
            DueDate = null
        };
    }

    [Fact]
    public async Task GetAll_returns_only_the_current_users_items()
    {
        // Arrange
        await using var database =
            await TestDatabase.CreateAsync();

        await using var db = database.CreateContext();

        var service = new WorkItemService(db);

        var first = await service.CreateAsync(
            TestDatabase.UserA,
            NewItem("First task"),
            Ct
        );

        var second = await service.CreateAsync(
            TestDatabase.UserA,
            NewItem("Second task"),
            Ct
        );

        var other = await service.CreateAsync(
            TestDatabase.UserB,
            NewItem("Private task"),
            Ct
        );

        // Act
        var result = await service.GetAllAsync(
            TestDatabase.UserA,
            new ListQuery
            {
                Page = 1,
                PageSize = 10
            },
            Ct
        );

        // Assert
        Assert.Equal(2, result.TotalCount);
        Assert.Equal(2, result.Items.Count);

        Assert.Contains(
            result.Items,
            item => item.Id == first.Id
        );

        Assert.Contains(
            result.Items,
            item => item.Id == second.Id
        );

        Assert.DoesNotContain(
            result.Items,
            item => item.Id == other.Id
        );
    }

    [Fact]
    public async Task GetById_hides_another_users_item()
    {
        // Arrange
        await using var database =
            await TestDatabase.CreateAsync();

        await using var db = database.CreateContext();

        var service = new WorkItemService(db);

        var item = await service.CreateAsync(
            TestDatabase.UserA,
            NewItem("Private task"),
            Ct
        );

        // Act
        var otherUsersResult = await service.GetByIdAsync(
            TestDatabase.UserB,
            item.Id,
            Ct
        );

        var ownersResult = await service.GetByIdAsync(
            TestDatabase.UserA,
            item.Id,
            Ct
        );

        // Assert
        Assert.Null(otherUsersResult);
        Assert.NotNull(ownersResult);
        Assert.Equal(item.Id, ownersResult!.Id);
    }

    [Fact]
    public async Task Update_rejects_another_user_and_preserves_the_item()
    {
        // Arrange
        await using var database =
            await TestDatabase.CreateAsync();

        await using var db = database.CreateContext();

        var service = new WorkItemService(db);

        var item = await service.CreateAsync(
            TestDatabase.UserA,
            NewItem("Original title"),
            Ct
        );

        var input = new UpdateWorkItemInput
        {
            Title = "Attempted change",
            Description = "Changed description",
            Status = WorkStatus.Done,
            Priority = Priority.High,
            DueDate = null,

            // Use the correct version so ownership is
            // what must prevent this update.
            Version = item.Version
        };

        // Act
        var result = await service.UpdateAsync(
            TestDatabase.UserB,
            item.Id,
            input,
            Ct
        );

        // Verify the stored row using a fresh context.
        await using var verificationDb =
            database.CreateContext();

        var stored =
            await new WorkItemService(verificationDb)
                .GetByIdAsync(
                    TestDatabase.UserA,
                    item.Id,
                    Ct
                );

        // Assert
        Assert.Equal(
            WorkItemWriteStatus.NotFound,
            result.Status
        );

        Assert.NotNull(stored);

        // WorkItemDto is a record: compare all its values.
        Assert.Equal(item, stored);
    }

    [Fact]
    public async Task Delete_rejects_another_user_and_preserves_the_item()
    {
        // Arrange
        await using var database =
            await TestDatabase.CreateAsync();

        await using var db = database.CreateContext();

        var service = new WorkItemService(db);

        var item = await service.CreateAsync(
            TestDatabase.UserA,
            NewItem("Keep this task"),
            Ct
        );

        // Act
        var result = await service.DeleteAsync(
            TestDatabase.UserB,
            item.Id,
            item.Version,
            Ct
        );

        await using var verificationDb =
            database.CreateContext();

        var stored =
            await new WorkItemService(verificationDb)
                .GetByIdAsync(
                    TestDatabase.UserA,
                    item.Id,
                    Ct
                );

        // Assert
        Assert.Equal(
            WorkItemWriteStatus.NotFound,
            result
        );

        Assert.NotNull(stored);
        Assert.Equal(item, stored);
    }
}