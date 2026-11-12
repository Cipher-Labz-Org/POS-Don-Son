using System.Text;
using System.Text.Json;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using Serilog;
using DMS_Backend.Authorization;
using DMS_Backend.Configuration;
using DMS_Backend.Data;
using DMS_Backend.Data.Seeders;
using DMS_Backend.Filters;
using DMS_Backend.Mapping;
using DMS_Backend.Middleware;
using DMS_Backend.Services.Implementations;
using DMS_Backend.Services.Interfaces;

// Configure Npgsql to use UTC timestamps
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", false);

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog (sinks come from appsettings.json — avoid duplicating File sink here,
// which can cause two handles on the same path and confuses Docker volume permission debugging.)
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .CreateLogger();

builder.Host.UseSerilog();

try
{
    Log.Information("Starting DMS Backend API");

// Add configuration options
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
builder.Services.Configure<SuperAdminOptions>(builder.Configuration.GetSection(SuperAdminOptions.SectionName));
builder.Services.Configure<DevSeedOptions>(builder.Configuration.GetSection(DevSeedOptions.SectionName));

// Add DbContext
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"));
    options.ConfigureWarnings(warnings => 
        warnings.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
});

// Add Memory Cache for application-wide caching
builder.Services.AddMemoryCache();

// Add JWT Authentication
var jwtConfig = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>();
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtConfig!.Issuer,
        ValidAudience = jwtConfig.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtConfig.SecretKey)),
        ClockSkew = TimeSpan.Zero
    };
});

// Add Authorization with permission-based policies
builder.Services.AddAuthorization();
builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();

// Add CORS — must include every origin users type in the browser bar
// (localhost vs 127.0.0.1 are different origins). Override via Cors:AllowedOrigins.
var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
if (corsOrigins is not { Length: > 0 })
{
    corsOrigins =
    [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ];
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(corsOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// HttpClient for Labelary ZPL preview proxy
builder.Services.AddHttpClient("Labelary", client =>
{
    client.BaseAddress = new Uri("http://api.labelary.com");
    client.Timeout = TimeSpan.FromSeconds(15);
    client.DefaultRequestHeaders.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("image/png"));
});

// Register refresh token service (in-memory)
builder.Services.AddSingleton<IRefreshTokenService, InMemoryRefreshTokenService>();

// Register services
builder.Services.AddSingleton<ICacheService, MemoryCacheService>();
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IRoleService, RoleService>();
builder.Services.AddScoped<IPermissionService, PermissionService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ISystemLogService, SystemLogService>();
builder.Services.AddScoped<IAuthenticationLogService, AuthenticationLogService>();
builder.Services.AddScoped<IAuditLogService, AuditLogService>();
builder.Services.AddScoped<IDayLockService, DayLockService>();
builder.Services.AddScoped<IDailyProductionReportService, DailyProductionReportService>();
builder.Services.AddScoped<ISalesSummaryReportService, SalesSummaryReportService>();
builder.Services.AddScoped<IDailyShowroomTotalsReportService, DailyShowroomTotalsReportService>();
builder.Services.AddScoped<IDailySalesSystemBalanceReportService, DailySalesSystemBalanceReportService>();
builder.Services.AddScoped<IDailySaleReportService, DailySaleReportService>();
builder.Services.AddScoped<IDailySaleOfItemReportService, DailySaleOfItemReportService>();
builder.Services.AddScoped<IStockBfReportService, StockBfReportService>();
builder.Services.AddScoped<IDayEndService, DayEndService>();
builder.Services.AddScoped<ISaleRecordsService, SaleRecordsService>();
builder.Services.AddScoped<ICashierBalanceService, CashierBalanceService>();
builder.Services.AddScoped<IEmailService, EmailService>();

// Inventory services
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<IUnitOfMeasureService, UnitOfMeasureService>();
builder.Services.AddScoped<IProductPriceResolver, ProductPriceResolver>();
        builder.Services.AddScoped<IProductService, ProductService>();
builder.Services.AddScoped<IIngredientService, IngredientService>();

// Phase 4: Admin Master Data services
builder.Services.AddScoped<IOutletService, OutletService>();
builder.Services.AddScoped<IDeliveryTurnService, DeliveryTurnService>();
builder.Services.AddScoped<IDayTypeService, DayTypeService>();
builder.Services.AddScoped<IProductionSectionService, ProductionSectionService>();
builder.Services.AddScoped<ISectionConsumableService, SectionConsumableService>();
builder.Services.AddScoped<IOutletEmployeeService, OutletEmployeeService>();
builder.Services.AddScoped<ISystemSettingService, SystemSettingService>();
builder.Services.AddScoped<IApprovalQueueService, ApprovalQueueService>();

// Phase 4: Label, Pricing, Grid, Workflow, Security services
builder.Services.AddScoped<ILabelTemplateService, LabelTemplateService>();
builder.Services.AddScoped<ILabelPrinterService, LabelPrinterService>();
builder.Services.AddScoped<ILabelPrintingCommentService, LabelPrintingCommentService>();
builder.Services.AddScoped<ILabelSettingService, LabelSettingService>();
builder.Services.AddScoped<IRoundingRuleService, RoundingRuleService>();
builder.Services.AddScoped<IPriceListService, PriceListService>();
builder.Services.AddScoped<IGridConfigurationService, GridConfigurationService>();
builder.Services.AddScoped<IWorkflowConfigService, WorkflowConfigService>();
builder.Services.AddScoped<IAutoApprovalConfigService, AutoApprovalConfigService>();
builder.Services.AddScoped<ISecurityPolicyService, SecurityPolicyService>();

// Phase 5a: Recipe services
builder.Services.AddScoped<IRecipeTemplateService, RecipeTemplateService>();
builder.Services.AddScoped<IRecipeService, RecipeService>();
builder.Services.AddScoped<IRecipePlanService, RecipePlanService>();

// Phase B: Weight variants
builder.Services.AddScoped<IProductWeightVariantService, ProductWeightVariantService>();

// Phase 5b: DMS Planning services
builder.Services.AddScoped<IDefaultQuantityService, DefaultQuantityService>();
builder.Services.AddScoped<IDeliveryPlanService, DeliveryPlanService>();
builder.Services.AddScoped<IAdministratorDeliveryPlanService, AdministratorDeliveryPlanService>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<IImmediateOrderService, ImmediateOrderService>();
builder.Services.AddScoped<IFreezerStockService, FreezerStockService>();

// Phase 5c: DMS Computed Views services
builder.Services.AddScoped<IDeliverySummaryService, DeliverySummaryService>();
builder.Services.AddScoped<IDashboardPivotService, DashboardPivotService>();
builder.Services.AddScoped<IDashboardStatsService, DashboardStatsService>();
builder.Services.AddScoped<IProductionPlannerService, ProductionPlannerService>();
builder.Services.AddScoped<IStoresIssueNoteService, StoresIssueNoteService>();
builder.Services.AddScoped<IPrintService, PrintService>();
builder.Services.AddScoped<IReconciliationService, ReconciliationService>();

// Phase 6: Operations services
builder.Services.AddScoped<IDeliveryService, DeliveryService>();
builder.Services.AddScoped<IDnPrintJobService, DnPrintJobService>();
builder.Services.AddScoped<IDnPrintAgentService, DnPrintAgentService>();
builder.Services.AddScoped<ILabelPrintAgentService, LabelPrintAgentService>();
builder.Services.AddScoped<IPosDeviceAgentService, PosDeviceAgentService>();
builder.Services.AddScoped<IDisposalService, DisposalService>();
builder.Services.AddScoped<ITransferService, TransferService>();
builder.Services.AddScoped<IPosSaleService, PosSaleService>();
builder.Services.AddScoped<IPosSaleReceiptService, PosSaleReceiptService>();
builder.Services.AddScoped<IPosThemeConfigService, PosThemeConfigService>();
builder.Services.AddScoped<ICancellationService, CancellationService>();
builder.Services.AddScoped<IDeliveryReturnService, DeliveryReturnService>();
builder.Services.AddScoped<IStockBFService, StockBFService>();
builder.Services.AddScoped<ILabelPrintRequestService, LabelPrintRequestService>();
builder.Services.AddScoped<IShowroomLabelRequestService, ShowroomLabelRequestService>();
builder.Services.AddScoped<IOperationApprovalRecorder, OperationApprovalRecorderService>();
builder.Services.AddScoped<IOperationApprovalService, OperationApprovalService>();
builder.Services.AddScoped<IProductionApprovalService, ProductionApprovalService>();

// Phase 7: Production & Stock services
builder.Services.AddScoped<IShiftService, ShiftService>();
builder.Services.AddScoped<IDailyProductionService, DailyProductionService>();
builder.Services.AddScoped<IProductionCancelService, ProductionCancelService>();
builder.Services.AddScoped<IStockAdjustmentService, StockAdjustmentService>();
builder.Services.AddScoped<IDailyProductionPlanService, DailyProductionPlanService>();
builder.Services.AddScoped<ICurrentStockService, CurrentStockService>();

// Register generic repository
builder.Services.AddScoped(typeof(DMS_Backend.Repositories.IRepository<>), typeof(DMS_Backend.Repositories.Repository<>));

// Register seeders
builder.Services.AddScoped<ComprehensivePermissionSeeder>();
builder.Services.AddScoped<SuperAdminSeeder>();
builder.Services.AddScoped<SystemSettingsBootstrapSeeder>();
builder.Services.AddScoped<DevDataSeeder>();
builder.Services.AddScoped<WorkflowConfigDataSeeder>();
builder.Services.AddScoped<AutoApprovalConfigSeeder>();

// Register filters
builder.Services.AddScoped<AuditActionFilter>();
builder.Services.AddScoped<DayLockGuardFilter>();

builder.Services.AddControllers(options =>
{
    options.Filters.AddService<AuditActionFilter>();
    options.Filters.AddService<DayLockGuardFilter>();
})
.AddJsonOptions(options =>
{
    options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    options.JsonSerializerOptions.DictionaryKeyPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
});

// Add FluentValidation
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

// Add AutoMapper
// Note: Using AutoMapper 12.0.1 (last free version)
// Known vulnerability GHSA-rvv3-g6hj-g44x requires 25,000+ nested levels to exploit
// Our business domain (products, orders, inventory) doesn't have deep object graphs
// Suppressed in .csproj - consider migrating to Mapperly in future
builder.Services.AddAutoMapper(typeof(MappingProfile).Assembly);

// Add OpenAPI/Swagger with Scalar UI
builder.Services.AddOpenApi();

// Liveness/readiness endpoint for Docker, Kubernetes, and load balancers
builder.Services.AddHealthChecks();

var app = builder.Build();

// Run migrations and seeders
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var permissionSeeder = scope.ServiceProvider.GetRequiredService<ComprehensivePermissionSeeder>();
    var superAdminSeeder = scope.ServiceProvider.GetRequiredService<SuperAdminSeeder>();
    var systemSettingsBootstrapSeeder = scope.ServiceProvider.GetRequiredService<SystemSettingsBootstrapSeeder>();
    var devDataSeeder = scope.ServiceProvider.GetRequiredService<DevDataSeeder>();
    var workflowConfigDataSeeder = scope.ServiceProvider.GetRequiredService<WorkflowConfigDataSeeder>();
    var autoApprovalConfigSeeder = scope.ServiceProvider.GetRequiredService<AutoApprovalConfigSeeder>();
    var devSeedOptions = builder.Configuration.GetSection(DevSeedOptions.SectionName).Get<DevSeedOptions>();

    try
    {
        // Apply migrations
        await context.Database.MigrateAsync();

        // Ensure approval-related columns exist even if a migration was not applied (orphan migrations / drift).
        await context.EnsureApprovalStatusColumnsAsync();

        // delivery_plan_items.extra_quantity / is_excluded / weight_variant_id — model drift vs InitialCreate.
        await context.EnsureDeliveryPlanItemColumnsAsync();

        // immediate_orders scheduling columns (delivery_date, etc.) — mirrors AddImmediateOrderSchedulingFields.
        await context.EnsureImmediateOrderSchedulingColumnsAsync();

        // products.production_section_id, LabelTemplateId; delivery_plans.recipe_plan_id;
        // operation_approvals table; rounding_rules ratio columns — PhaseC empty Up() drift.
        await context.EnsureProductAndPlanColumnsAsync();

        // outlets.pos_verification_code — login joins Outlet and 500s if the column is missing.
        await context.EnsureOutletColumnsAsync();

        // categories.SortOrder — POS catalog sync 500s if the column is missing after deploy.
        await context.EnsureCategoryColumnsAsync();

        // sale_records_settings + cashier_sale_notifications
        await context.EnsureSaleRecordsTablesAsync();

        // cashier_balance_outlet_lines.cashier_name — POS Cash Submission 500s if missing
        await context.EnsureCashierBalanceColumnsAsync();

        // transfers.received_by_id / received_at — POS New Transfer 500s if missing
        await context.EnsureTransferColumnsAsync();

        // pos_device_agents — Super Admin header GET /api/pos-devices/status 500s if missing
        await context.EnsurePosDeviceAgentsTableAsync();

        // cancellations.delivery_no / delivered_date are optional (form no longer collects them)
        await context.EnsureCancellationDeliveryFieldsOptionalAsync();

        // Seed permissions first
        await permissionSeeder.SeedAsync();

        // Then seed super admin
        await superAdminSeeder.SeedAsync();

        await systemSettingsBootstrapSeeder.SeedAsync();

        // Seed workflow operation definitions
        await workflowConfigDataSeeder.SeedAsync();

        // Seed auto-approval configurations
        await autoApprovalConfigSeeder.SeedAsync();

        // Always ensure POS catalog visibility and role permissions (DisplayInPOS, products:view, etc.)
        await devDataSeeder.EnsurePosCatalogReadyAsync();

        // Seed dev data if enabled (never in Production — see DevDataSeeder.SeedAsync guard)
        if (devSeedOptions?.Enabled == true)
        {
            if (app.Environment.IsProduction())
            {
                Log.Warning(
                    "DevSeed:Enabled is true but ASPNETCORE_ENVIRONMENT=Production — demo data will NOT be seeded");
            }
            else
            {
                Log.Information("Dev seed is enabled, seeding development data");
                await devDataSeeder.SeedAsync();
            }
        }

        var productTotal = await context.Products.IgnoreQueryFilters().CountAsync();
        var demoProductCount = await context.Products
            .IgnoreQueryFilters()
            .CountAsync(p => DevDataSeeder.DemoProductCodes.Contains(p.Code));
        var connStr = context.Database.GetConnectionString() ?? "(not set)";
        var dbTarget = TryFormatDbTarget(connStr);
        Log.Information(
            "Database catalog summary: {DbTarget} totalProducts={ProductTotal} demoSeedProducts={DemoCount}",
            dbTarget,
            productTotal,
            demoProductCount);
        if (productTotal > 0 && productTotal <= 15 && demoProductCount >= 10)
        {
            Log.Warning(
                "Only {Count} products in API database and most match dev demo codes (BR001, PA001, …). " +
                "If pgAdmin shows more products, backend is on a different PostgreSQL. " +
                "Use docker-compose.local-pg.yml on the client server.",
                productTotal);
        }

        Log.Information("Database seeded successfully");
    }
    catch (Exception ex)
    {
        // Fail fast: a first-time run must apply migrations and seed permissions +
        // super admin. Starting the API with a half-initialised database hides
        // connection/config issues and breaks login / RBAC until someone notices.
        Log.Fatal(ex, "Database migration or seeding failed — fix PostgreSQL, connection string, and SuperAdmin config, then retry.");
        throw;
    }
}

// Configure the HTTP request pipeline.
// CORS must run BEFORE ExceptionMiddleware so error responses still carry
// Access-Control-Allow-Origin headers — otherwise a 500 from the API surfaces
// in the browser as the misleading "blocked by CORS policy" error instead of
// the real status code.
app.UseCors("AllowFrontend");
app.UseMiddleware<ExceptionMiddleware>();
app.UseMiddleware<ApiRequestLoggingMiddleware>();

// Liveness — no auth; keep before OpenAPI for predictable probe behaviour
app.MapHealthChecks("/health");

// Friendly landing page at / so opening http://SERVER:5126 in a browser is not a blank 404.
// Port 5126 is the API (not DMS Web :3000 or browser POS :5174).
app.MapGet("/", (HttpRequest req) =>
{
    var host = req.Host.Host;
    var web = $"http://{host}:3000";
    var pos = $"http://{host}:5174";
    var api = $"{req.Scheme}://{req.Host}";
    var html = $$"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Don &amp; Sons DMS API</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 3rem auto; padding: 0 1rem; color: #1a1a1a; }
            h1 { color: #b91c1c; font-size: 1.5rem; }
            code { background: #f3f4f6; padding: 0.1rem 0.35rem; border-radius: 4px; }
            a { color: #b91c1c; }
            .box { border: 1px solid #e5e7eb; border-radius: 12px; padding: 1rem 1.25rem; margin: 1rem 0; background: #fafafa; }
            ul { line-height: 1.7; }
          </style>
        </head>
        <body>
          <h1>Don &amp; Sons — DMS API</h1>
          <p>This port (<code>5126</code>) is the <strong>backend API</strong>, not a website UI.</p>
          <div class="box">
            <p><strong>Open these instead:</strong></p>
            <ul>
              <li>DMS Web: <a href="{{web}}">{{web}}</a></li>
              <li>Browser POS: <a href="{{pos}}">{{pos}}</a></li>
              <li>API health: <a href="/health">/health</a></li>
              <li>API docs: <a href="/scalar/v1">/scalar/v1</a></li>
            </ul>
          </div>
          <p>Desktop POS apps must use this address as <strong>Server URL</strong>:
            <code>{{api}}</code></p>
        </body>
        </html>
        """;
    return Results.Content(html, "text/html; charset=utf-8");
}).AllowAnonymous();

// Map OpenAPI endpoint and enable Scalar UI
app.MapOpenApi();
app.MapScalarApiReference(options =>
{
    options
        .WithTitle("DMS Backend API")
        .WithTheme(Scalar.AspNetCore.ScalarTheme.Mars)
        .WithDefaultHttpClient(Scalar.AspNetCore.ScalarTarget.CSharp, Scalar.AspNetCore.ScalarClient.HttpClient);
});

// Only redirect to HTTPS when this process actually listens for HTTPS.
// Docker / reverse-proxy setups often expose HTTP only; redirecting breaks API clients.
var urlsConfigured = builder.Configuration["ASPNETCORE_URLS"] ?? string.Empty;
var httpsPorts = builder.Configuration["HTTPS_PORTS"] ?? builder.Configuration["ASPNETCORE_HTTPS_PORTS"];
var listensHttps = urlsConfigured.Contains("https:", StringComparison.OrdinalIgnoreCase)
    || (!string.IsNullOrWhiteSpace(httpsPorts) && httpsPorts != "0");
if (!app.Environment.IsDevelopment() && listensHttps)
{
    app.UseHttpsRedirection();
}

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

Log.Information("DMS Backend API started successfully");
app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "DMS Backend API terminated unexpectedly");
    throw;
}
finally
{
    Log.CloseAndFlush();
}

static string TryFormatDbTarget(string connectionString)
{
    try
    {
        var b = new Npgsql.NpgsqlConnectionStringBuilder(connectionString);
        return $"Host={b.Host};Port={b.Port};Database={b.Database};User={b.Username}";
    }
    catch
    {
        return "(could not parse connection string)";
    }
}
