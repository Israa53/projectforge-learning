using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using ProjectForge.Api.Contracts;
using Xunit;

namespace ProjectForge.Api.Tests.Http;

public class WorkItemHttpTests
{
    private static readonly JsonSerializerOptions JsonOptions =
        new(JsonSerializerDefaults.Web)
        {
            Converters =
            {
                new JsonStringEnumConverter()
            }
        };

    private static object NewItem(string title) => new
    {
        title,
        description = "Details",
        status = "Backlog",
        priority = "Medium",
        dueDate = (string?)null
    };

    private static object EditItem(
        Guid version,
        string title) => new
        {
            title,
            description = "Updated details",
            status = "Done",
            priority = "High",
            dueDate = (string?)null,
            version
        };

    private static async Task<WorkItemDto> CreateItemAsync(
        HttpClient client)
    {
        using var response = await client.PostAsJsonAsync(
            "/api/work-items",
            NewItem("Invoice task")
        );

        Assert.Equal(
            HttpStatusCode.Created,
            response.StatusCode
        );

        var item = await response.Content
            .ReadFromJsonAsync<WorkItemDto>(JsonOptions);

        Assert.NotNull(item);
        Assert.NotNull(response.Headers.Location);

        Assert.EndsWith(
            $"/api/work-items/{item!.Id}",
            response.Headers.Location!.ToString()
        );

        return item;
    }

    [Theory]
    [InlineData("GET", "/api/work-items")]
    [InlineData(
        "GET",
        "/api/work-items/11111111-1111-4111-8111-111111111111"
    )]
    [InlineData("POST", "/api/work-items")]
    [InlineData(
        "PUT",
        "/api/work-items/11111111-1111-4111-8111-111111111111"
    )]
    [InlineData(
        "DELETE",
        "/api/work-items/11111111-1111-4111-8111-111111111111"
    )]
    public async Task Anonymous_requests_return_401(
        string method,
        string path)
    {
        using var factory = new TestApiFactory();
        using var client = factory.CreateApiClient();

        using var request = new HttpRequestMessage(
            new HttpMethod(method),
            path
        );

        using var response = await client.SendAsync(request);

        Assert.Equal(
            HttpStatusCode.Unauthorized,
            response.StatusCode
        );
    }

    [Theory]
    [InlineData("")]
    [InlineData("ab")]
    [InlineData("   ")]
    public async Task Invalid_title_returns_400_with_field_errors(
        string title)
    {
        using var factory = new TestApiFactory();

        using var client = factory.CreateApiClient(
            TestDatabase.UserA
        );

        using var response = await client.PostAsJsonAsync(
            "/api/work-items",
            NewItem(title)
        );

        Assert.Equal(
            HttpStatusCode.BadRequest,
            response.StatusCode
        );

        using var problem = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync()
        );

        var errors = problem.RootElement.GetProperty("errors");

        Assert.Contains(
            errors.EnumerateObject(),
            field =>
                field.Name.Equals(
                    "Title",
                    StringComparison.OrdinalIgnoreCase
                ) &&
                field.Value.GetArrayLength() > 0
        );

        var list = await client.GetFromJsonAsync<
            PagedResult<WorkItemDto>
        >(
            "/api/work-items",
            JsonOptions
        );

        Assert.NotNull(list);
        Assert.Equal(0, list!.TotalCount);
    }

    [Fact]
    public async Task Successful_crud_returns_expected_statuses_and_data()
    {
        using var factory = new TestApiFactory();

        using var client = factory.CreateApiClient(
            TestDatabase.UserA
        );

        var item = await CreateItemAsync(client);
        var path = $"/api/work-items/{item.Id}";

        using var read = await client.GetAsync(path);

        Assert.Equal(
            HttpStatusCode.OK,
            read.StatusCode
        );

        Assert.Equal(
            item,
            await read.Content.ReadFromJsonAsync<WorkItemDto>(
                JsonOptions
            )
        );

        using var missingVersion =
            await client.DeleteAsync(path);

        Assert.Equal(
            HttpStatusCode.BadRequest,
            missingVersion.StatusCode
        );

        using var update = await client.PutAsJsonAsync(
            path,
            EditItem(item.Version, "Invoice updated")
        );

        Assert.Equal(
            HttpStatusCode.OK,
            update.StatusCode
        );

        var updated = await update.Content
            .ReadFromJsonAsync<WorkItemDto>(JsonOptions);

        Assert.NotNull(updated);
        Assert.Equal("Invoice updated", updated!.Title);
        Assert.NotEqual(item.Version, updated.Version);

        using var deletion = await client.DeleteAsync(
            $"{path}?version={updated.Version}"
        );

        Assert.Equal(
            HttpStatusCode.NoContent,
            deletion.StatusCode
        );

        using var afterDelete = await client.GetAsync(path);

        Assert.Equal(
            HttpStatusCode.NotFound,
            afterDelete.StatusCode
        );
    }

    [Fact]
    public async Task Another_users_item_is_hidden_and_cannot_be_changed()
    {
        using var factory = new TestApiFactory();

        using var owner = factory.CreateApiClient(
            TestDatabase.UserA
        );

        using var other = factory.CreateApiClient(
            TestDatabase.UserB
        );

        var item = await CreateItemAsync(owner);
        var path = $"/api/work-items/{item.Id}";

        using var read = await other.GetAsync(path);

        using var update = await other.PutAsJsonAsync(
            path,
            EditItem(item.Version, "Attempted overwrite")
        );

        using var deletion = await other.DeleteAsync(
            $"{path}?version={item.Version}"
        );

        Assert.Equal(
            HttpStatusCode.NotFound,
            read.StatusCode
        );

        Assert.Equal(
            HttpStatusCode.NotFound,
            update.StatusCode
        );

        Assert.Equal(
            HttpStatusCode.NotFound,
            deletion.StatusCode
        );

        var list = await other.GetFromJsonAsync<
            PagedResult<WorkItemDto>
        >(
            "/api/work-items",
            JsonOptions
        );

        Assert.NotNull(list);
        Assert.Empty(list!.Items);

        var stored = await owner.GetFromJsonAsync<WorkItemDto>(
            path,
            JsonOptions
        );

        Assert.Equal(item, stored);
    }

    [Fact]
    public async Task Stale_update_and_delete_return_409_and_preserve_newer_data()
    {
        using var factory = new TestApiFactory();

        using var client = factory.CreateApiClient(
            TestDatabase.UserA
        );

        var item = await CreateItemAsync(client);
        var path = $"/api/work-items/{item.Id}";

        using var firstUpdate = await client.PutAsJsonAsync(
            path,
            EditItem(item.Version, "Newer title")
        );

        Assert.Equal(
            HttpStatusCode.OK,
            firstUpdate.StatusCode
        );

        var newer = await firstUpdate.Content
            .ReadFromJsonAsync<WorkItemDto>(JsonOptions);

        Assert.NotNull(newer);

        using var staleUpdate = await client.PutAsJsonAsync(
            path,
            EditItem(item.Version, "Stale overwrite")
        );

        using var staleDelete = await client.DeleteAsync(
            $"{path}?version={item.Version}"
        );

        Assert.Equal(
            HttpStatusCode.Conflict,
            staleUpdate.StatusCode
        );

        Assert.Equal(
            HttpStatusCode.Conflict,
            staleDelete.StatusCode
        );

        var stored = await client.GetFromJsonAsync<WorkItemDto>(
            path,
            JsonOptions
        );

        Assert.Equal(newer, stored);
    }
}