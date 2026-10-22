using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using ProjectForge.Api.Auth;
using ProjectForge.Api.Data;
using ProjectForge.Api.Models;

var builder = WebApplication.CreateBuilder(args);

// Register API services and keep enum values in JSON readable as strings.
builder.Services.AddControllers().AddJsonOptions(options =>
    options.JsonSerializerOptions.Converters.Add(
        new JsonStringEnumConverter(allowIntegerValues: false)));

// Use the configured SQLite connection for the application's database context.
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Database")));

// Configure account rules and store Identity data through Entity Framework.
builder.Services.AddIdentityCore<ApplicationUser>(options =>
{
    options.User.RequireUniqueEmail = true;
    options.Password.RequiredLength = 12;
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
})
.AddEntityFrameworkStores<AppDbContext>()
.AddSignInManager();

// Load JWT settings and fail at startup if required values are missing or invalid.
var jwt = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new();
if (string.IsNullOrWhiteSpace(jwt.SigningKey))
    throw new InvalidOperationException("Set Jwt:SigningKey with dotnet user-secrets first.");

var signingKey = Convert.FromBase64String(jwt.SigningKey);
if (signingKey.Length < 32 || string.IsNullOrWhiteSpace(jwt.Issuer) ||
    string.IsNullOrWhiteSpace(jwt.Audience) || jwt.AccessTokenMinutes is < 1 or > 15)
    throw new InvalidOperationException("Invalid JWT configuration.");

builder.Services.AddSingleton(jwt);
builder.Services.AddSingleton<TokenIssuer>();
builder.Services.AddScoped<AuthSessionService>();

// Accept only signed JWTs with the expected issuer, audience, algorithm, and lifetime.
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateLifetime = true,
            RequireExpirationTime = true,
            RequireSignedTokens = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(signingKey),
            ValidAlgorithms = new[] { SecurityAlgorithms.HmacSha256 },
            ClockSkew = TimeSpan.FromSeconds(10),
            NameClaimType = "email"
        };
    });

builder.Services.AddAuthorization();

// Configure the antiforgery token header and secure cookie used by browser requests.
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = "__Host-projectforge.csrf";
    options.Cookie.Path = "/";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Strict;
});

// Limit authentication requests by client IP and return HTTP 429 when the limit is reached.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 30,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            AutoReplenishment = true
        }));
});

builder.Services.AddProblemDetails();
// Register services that generate the OpenAPI document and customize its security metadata.
builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer((document, _, _) =>
    {
        // Advertise bearer authentication in OpenAPI so clients can authorize requests.
        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes ??=
            new Dictionary<string, IOpenApiSecurityScheme>();
        document.Components.SecuritySchemes["Bearer"] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT"
        };

        // Only /me requires a bearer token in this checkpoint.
        foreach (var entry in document.Paths)
        {
            var requiresBearer =
                entry.Key == "/api/auth/me" ||
                entry.Key == "/api/work-items" ||
                entry.Key.StartsWith(
                    "/api/work-items/",
                    StringComparison.Ordinal
                );

            if (!requiresBearer || entry.Value.Operations is null)
            {
                continue;
            }

            foreach (var operation in entry.Value.Operations.Values)
            {
                operation.Security ??=
                    new List<OpenApiSecurityRequirement>();

                operation.Security.Add(
                    new OpenApiSecurityRequirement
                    {
                        [new OpenApiSecuritySchemeReference(
                            "Bearer",
                            document
                        )] = new List<string>()
                    }
                );
            }
        }
        return Task.CompletedTask;
    });
});

// Build the configured services and middleware into the web application.
var app = builder.Build();

// Keep exception and status-code responses consistent, then apply request policies
// before the controllers handle each request.
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

// Expose the OpenAPI document and Swagger UI only in development.
if (app.Environment.IsDevelopment())
{
    // Publish the generated OpenAPI document while developing locally.
    app.MapOpenApi();

    // Provide an interactive UI for exploring the API documentation.
    app.UseSwaggerUI(options => options.SwaggerEndpoint(
        "/openapi/v1.json", "ProjectForge API v1"));
}

// Match incoming HTTP requests to controller actions.
app.MapControllers();

// Start the web server and begin handling requests.
app.Run();

// Make Program accessible to integration-test projects.
public partial class Program { }
