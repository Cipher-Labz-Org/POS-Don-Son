using Microsoft.EntityFrameworkCore;
using DMS_Backend.Models.Entities;

namespace DMS_Backend.Data.Seeders;

/// <summary>
/// Comprehensive permission seeder aligned with actual controller permission checks
/// CRITICAL: Permission codes MUST match the exact strings used in [HasPermission("...")] attributes.
///
/// This seeder is idempotent: it inserts permissions that are missing from the
/// database WITHOUT touching ones that already exist. This means new
/// permissions added to the catalog automatically appear after the next
/// backend start, without affecting role assignments.
/// </summary>
public sealed class ComprehensivePermissionSeeder
{
    private readonly ApplicationDbContext _context;
    private int _displayOrder = 0;

    public ComprehensivePermissionSeeder(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task SeedAsync()
    {
        // Establish the next DisplayOrder so newly inserted permissions slot in
        // after the existing ones.
        var existing = await _context.Permissions
            .Select(p => new { p.Code, p.DisplayOrder })
            .ToListAsync();
        var existingCodes = new HashSet<string>(existing.Select(e => e.Code), StringComparer.OrdinalIgnoreCase);
        _displayOrder = existing.Any() ? (existing.Max(e => e.DisplayOrder ?? 0) + 1) : 0;

        var allPermissions = BuildCatalog();

        // Dedupe by code (case-insensitive). The catalog now includes both
        // explicit historical codes and the auto-generated full action set
        // for every prefix, so duplicates are expected and must be collapsed
        // before insert (the `permissions.Code` column has a UNIQUE index).
        var deduped = allPermissions
            .GroupBy(p => p.Code, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.First())
            .ToList();

        var toInsert = deduped
            .Where(p => !existingCodes.Contains(p.Code))
            .ToList();

        if (toInsert.Count == 0)
            return;

        await _context.Permissions.AddRangeAsync(toInsert);
        await _context.SaveChangesAsync();
    }

    private List<Permission> BuildCatalog()
    {
        var permissions = new List<Permission>();

        // ============================================================
        // ADMINISTRATOR MODULE - Users
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Administrator", "Users", new[]
        {
            ("users:read", "View", "View users list and details"),
            ("users:create", "Create", "Create new users"),
            ("users:update", "Update", "Update existing users"),
            ("users:delete", "Delete", "Delete users")
        }));

        // ============================================================
        // ADMINISTRATOR MODULE - Roles
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Administrator", "Roles", new[]
        {
            ("roles:read", "View", "View roles list and details"),
            ("roles:create", "Create", "Create new roles"),
            ("roles:update", "Update", "Update existing roles"),
            ("roles:delete", "Delete", "Delete roles")
        }));

        // ============================================================
        // ADMINISTRATOR MODULE - Permissions
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Administrator", "Permissions", new[]
        {
            ("permissions:read", "View", "View all available permissions")
        }));

        // ============================================================
        // ADMINISTRATOR MODULE - System Settings
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Administrator", "SystemSettings", new[]
        {
            ("setting:view", "View", "View system settings"),
            ("setting:edit", "Update", "Update system settings")
        }));

        // ============================================================
        // ADMINISTRATOR MODULE - Label Settings
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Administrator", "LabelSettings", new[]
        {
            ("label-settings:view", "View", "View label settings"),
            ("label-settings:create", "Create", "Create label settings"),
            ("label-settings:edit", "Update", "Update label settings"),
            ("label-settings:delete", "Delete", "Delete label settings")
        }));

        // ============================================================
        // ADMINISTRATOR MODULE - Label Templates
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Administrator", "LabelTemplates", new[]
        {
            ("label-templates:view", "View", "View label templates"),
            ("label-templates:create", "Create", "Create label templates"),
            ("label-templates:edit", "Update", "Update label templates"),
            ("label-templates:delete", "Delete", "Delete label templates")
        }));

        // ============================================================
        // ADMINISTRATOR MODULE - Showroom Employees
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Administrator", "ShowroomEmployee", new[]
        {
            ("employee:view", "View", "View showroom employees"),
            ("employee:create", "Create", "Create showroom employees"),
            ("employee:edit", "Update", "Update showroom employees"),
            ("employee:delete", "Delete", "Delete showroom employees")
        }));

        // ============================================================
        // ADMINISTRATOR MODULE - Price Manager
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Administrator", "PriceManager", new[]
        {
            ("pricing:view", "View", "View product prices"),
            ("pricing:create", "Create", "Create price entries"),
            ("pricing:edit", "Update", "Update product prices"),
            ("pricing:delete", "Delete", "Delete price entries")
        }));

        // ============================================================
        // ADMINISTRATOR MODULE - Workflow Config
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Administrator", "WorkflowConfig", new[]
        {
            ("workflow-config:view", "View", "View workflow configurations"),
            ("workflow-config:create", "Create", "Create workflow configurations"),
            ("workflow-config:edit", "Update", "Update workflow configurations"),
            ("workflow-config:delete", "Delete", "Delete workflow configurations")
        }));

        // ============================================================
        // ADMINISTRATOR MODULE - Auto-Approval Config
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Administrator", "AutoApprovalConfig", new[]
        {
            ("auto-approval-config:view", "View", "View auto-approval configurations"),
            ("auto-approval-config:edit", "Update", "Update auto-approval configurations")
        }));

        // ============================================================
        // ADMINISTRATOR MODULE - Grid Configuration
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Administrator", "GridConfiguration", new[]
        {
            ("grid-config:view", "View", "View grid configurations"),
            ("grid-config:create", "Create", "Create grid configurations"),
            ("grid-config:edit", "Update", "Update grid configurations"),
            ("grid-config:delete", "Delete", "Delete grid configurations")
        }));

        // ============================================================
        // ADMINISTRATOR MODULE - Day Types
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Administrator", "DayTypes", new[]
        {
            ("day_type:view", "View", "View day types"),
            ("day_type:create", "Create", "Create day types"),
            ("day_type:edit", "Update", "Update day types"),
            ("day_type:delete", "Delete", "Delete day types")
        }));

        // ============================================================
        // ADMINISTRATOR MODULE - Delivery Turns
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Administrator", "DeliveryTurns", new[]
        {
            ("delivery_turn:view", "View", "View delivery turns"),
            ("delivery_turn:create", "Create", "Create delivery turns"),
            ("delivery_turn:edit", "Update", "Update delivery turns"),
            ("delivery_turn:delete", "Delete", "Delete delivery turns")
        }));

        // ============================================================
        // ADMINISTRATOR MODULE - Rounding Rules
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Administrator", "RoundingRules", new[]
        {
            ("rounding-rules:view", "View", "View rounding rules"),
            ("rounding-rules:create", "Create", "Create rounding rules"),
            ("rounding-rules:edit", "Update", "Update rounding rules"),
            ("rounding-rules:delete", "Delete", "Delete rounding rules")
        }));

        // ============================================================
        // ADMINISTRATOR MODULE - Section Consumables
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Administrator", "SectionConsumables", new[]
        {
            ("section-consumables:view", "View", "View section consumables"),
            ("section-consumables:create", "Create", "Create section consumables"),
            ("section-consumables:edit", "Update", "Update section consumables"),
            ("section-consumables:delete", "Delete", "Delete section consumables")
        }));

        // ============================================================
        // ADMINISTRATOR MODULE - Security Policies
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Administrator", "Security", new[]
        {
            ("security-policies:view", "View", "View security settings"),
            ("security-policies:create", "Create", "Create security policies"),
            ("security-policies:edit", "Update", "Update security settings"),
            ("security-policies:delete", "Delete", "Delete security policies")
        }));

        // ============================================================
        // ADMINISTRATOR MODULE - Day Lock
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Administrator", "DayLock", new[]
        {
            ("admin:view", "View", "View day lock status"),
            ("admin:day-lock", "Lock", "Lock/unlock a day")
        }));

        // ============================================================
        // ADMINISTRATOR MODULE - Parent Module Access
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Administrator", "Module", new[]
        {
            ("administrator:view", "View", "Access administrator module")
        }));

        // ============================================================
        // ADMINISTRATOR MODULE - Day-End Process
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Administrator", "DayEndProcess", new[]
        {
            ("day-end:view", "View", "View day-end process"),
            ("day-end:execute", "Execute", "Execute day-end process"),
            ("day-end:notify", "Notify", "Notify cashiers of sale records after day lock"),
            ("day-end:edit", "Update", "Update day-end / POS sale-records settings")
        }));

        // ============================================================
        // ADMINISTRATOR MODULE - Cashier Balance
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Administrator", "CashierBalance", new[]
        {
            ("cashier-balance:view", "View", "View cashier balance"),
            ("cashier-balance:create", "Create", "Create cashier balance entries"),
            ("cashier-balance:edit", "Update", "Update cashier balance"),
            ("cashier-balance:delete", "Delete", "Delete cashier balance entries")
        }));

        // ============================================================
        // ADMINISTRATOR MODULE - Delivery Plan (Admin specific)
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Administrator", "AdminDeliveryPlan", new[]
        {
            ("admin-delivery-plan:view", "View", "View admin delivery plan"),
            ("admin-delivery-plan:create", "Create", "Create admin delivery plan"),
            ("admin-delivery-plan:edit", "Update", "Update admin delivery plan"),
            ("admin-delivery-plan:delete", "Delete", "Delete admin delivery plan")
        }));

        // ============================================================
        // ADMINISTRATOR MODULE - Approvals
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Administrator", "Approvals", new[]
        {
            ("approval:view", "View", "View approval workflows"),
            ("approval:approve", "Approve", "Approve pending items"),
            ("approval:reject", "Reject", "Reject pending items")
        }));

        // ============================================================
        // INVENTORY MODULE
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Inventory", "Products", new[]
        {
            ("products:view", "View", "View products list and details"),
            ("products:create", "Create", "Create new products"),
            ("products:edit", "Update", "Update existing products"),
            ("products:delete", "Delete", "Delete products"),
            ("products:import", "Import", "Import products from file"),
            ("products:export", "Export", "Export products to file")
        }));

        permissions.AddRange(CreatePermissionsFromCodes("Inventory", "Categories", new[]
        {
            ("categories:view", "View", "View categories"),
            ("categories:create", "Create", "Create categories"),
            ("categories:edit", "Update", "Update categories"),
            ("categories:delete", "Delete", "Delete categories")
        }));

        permissions.AddRange(CreatePermissionsFromCodes("Inventory", "UnitOfMeasure", new[]
        {
            ("unit-of-measure:view", "View", "View units of measure"),
            ("unit-of-measure:create", "Create", "Create units of measure"),
            ("unit-of-measure:edit", "Update", "Update units of measure"),
            ("unit-of-measure:delete", "Delete", "Delete units of measure")
        }));

        permissions.AddRange(CreatePermissionsFromCodes("Inventory", "Ingredients", new[]
        {
            ("ingredients:view", "View", "View ingredients"),
            ("ingredients:create", "Create", "Create ingredients"),
            ("ingredients:edit", "Update", "Update ingredients"),
            ("ingredients:delete", "Delete", "Delete ingredients"),
            ("ingredients:import", "Import", "Import ingredients from file"),
            ("ingredients:export", "Export", "Export ingredients to file")
        }));

        // ============================================================
        // SHOWROOM MODULE
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Showroom", "Outlets", new[]
        {
            ("showroom:view", "View", "View showrooms/outlets"),
            ("showroom:create", "Create", "Create showrooms"),
            ("showroom:edit", "Update", "Update showrooms"),
            ("showroom:delete", "Delete", "Delete showrooms")
        }));

        // ============================================================
        // OPERATION MODULE - Unified Approvals
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Operation", "Approvals", new[]
        {
            ("operation:approvals:view",   "View",   "View all operation approvals in unified page"),
            ("operation:approvals:create", "Create", "Record a status transition in the audit trail")
        }));

        // ============================================================
        // OPERATION MODULE - Delivery
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Operation", "Delivery", new[]
        {
            ("operation:delivery:view", "View", "View deliveries"),
            ("operation:delivery:create", "Create", "Create deliveries"),
            ("operation:delivery:update", "Update", "Update deliveries"),
            ("operation:delivery:delete", "Delete", "Delete deliveries"),
            ("operation:delivery:approve", "Approve", "Approve deliveries"),
            ("operation:delivery:reject", "Reject", "Reject deliveries"),
            ("operation:delivery:auto-approve", "AutoApprove", "Auto-approve delivery entries on creation"),
            ("operation:delivery:allow-back-date", "AllowBackDate", "Allow back-dated delivery records"),
            ("operation:delivery:allow-future-date", "AllowFutureDate", "Allow future-dated delivery records")
        }));

        // ============================================================
        // OPERATION MODULE - Delivery Returns
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Operation", "DeliveryReturn", new[]
        {
            ("operation:delivery-return:view", "View", "View delivery returns"),
            ("operation:delivery-return:create", "Create", "Create delivery returns"),
            ("operation:delivery-return:update", "Update", "Update delivery returns"),
            ("operation:delivery-return:delete", "Delete", "Delete delivery returns"),
            ("operation:delivery-return:approve", "Approve", "Approve delivery returns"),
            ("operation:delivery-return:reject", "Reject", "Reject delivery returns"),
            ("operation:delivery-return:auto-approve", "AutoApprove", "Auto-approve delivery return entries on creation"),
            ("operation:delivery-return:allow-back-date", "AllowBackDate", "Allow back-dated delivery return records"),
            ("operation:delivery-return:allow-future-date", "AllowFutureDate", "Allow future-dated delivery return records")
        }));

        // ============================================================
        // OPERATION MODULE - Disposal
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Operation", "Disposal", new[]
        {
            ("operation:disposal:view", "View", "View disposals"),
            ("operation:disposal:create", "Create", "Create disposal records"),
            ("operation:disposal:update", "Update", "Update disposals"),
            ("operation:disposal:delete", "Delete", "Delete disposals"),
            ("operation:disposal:approve", "Approve", "Approve disposals"),
            ("operation:disposal:reject", "Reject", "Reject disposals"),
            ("operation:disposal:auto-approve", "AutoApprove", "Auto-approve disposal entries on creation"),
            ("operation:disposal:allow-back-date", "AllowBackDate", "Allow back-dated disposal records"),
            ("operation:disposal:allow-future-date", "AllowFutureDate", "Allow future-dated disposal records")
        }));

        // ============================================================
        // OPERATION MODULE - Transfer
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Operation", "Transfer", new[]
        {
            ("operation:transfer:view", "View", "View transfers"),
            ("operation:transfer:create", "Create", "Create transfers"),
            ("operation:transfer:update", "Update", "Update transfers"),
            ("operation:transfer:delete", "Delete", "Delete transfers"),
            ("operation:transfer:approve", "Approve", "Approve transfers"),
            ("operation:transfer:reject", "Reject", "Reject transfers"),
            ("operation:transfer:auto-approve", "AutoApprove", "Auto-approve transfer entries on creation"),
            ("operation:transfer:allow-back-date", "AllowBackDate", "Allow back-dated transfer records"),
            ("operation:transfer:allow-future-date", "AllowFutureDate", "Allow future-dated transfer records")
        }));

        // ============================================================
        // OPERATION MODULE - POS (showroom sales)
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Operation", "PosSale", new[]
        {
            ("pos:sale:view",    "View",    "View POS / showroom sales"),
            ("pos:sale:create",  "Create",  "Record POS / showroom sales"),
            ("pos:sale:approve", "Approve", "Approve POS / showroom sales"),
            ("pos:sale:reject",  "Reject",  "Reject POS / showroom sales"),
            ("pos:sale:void",    "Void",    "Void an approved POS / showroom sale (supervisor)"),
            ("pos:sale-records:view", "View", "View POS sale records (cashier differences)")
        }));

        // ============================================================
        // ADMINISTRATOR MODULE - POS Theme
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Administrator", "PosTheme", new[]
        {
            ("pos-theme:view", "View", "View POS theme configurations"),
            ("pos-theme:create", "Create", "Create POS theme configurations"),
            ("pos-theme:edit", "Update", "Update POS theme configurations"),
            ("pos-theme:delete", "Delete", "Delete POS theme configurations")
        }));

        // ============================================================
        // OPERATION MODULE - Stock BF
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Operation", "StockBF", new[]
        {
            ("operation:stock-bf:view", "View", "View stock brought forward"),
            ("operation:stock-bf:create", "Create", "Create stock BF entries"),
            ("operation:stock-bf:update", "Update", "Update stock BF"),
            ("operation:stock-bf:delete", "Delete", "Delete stock BF"),
            ("operation:stock-bf:approve", "Approve", "Approve stock BF"),
            ("operation:stock-bf:reject", "Reject", "Reject stock BF"),
            ("operation:stock-bf:auto-approve", "AutoApprove", "Auto-approve stock BF entries on creation"),
            ("operation:stock-bf:allow-back-date", "AllowBackDate", "Allow back-dated stock BF records"),
            ("operation:stock-bf:allow-future-date", "AllowFutureDate", "Allow future-dated stock BF records")
        }));

        // ============================================================
        // OPERATION MODULE - Cancellation
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Operation", "Cancellation", new[]
        {
            ("operation:cancellation:view", "View", "View cancellations"),
            ("operation:cancellation:create", "Create", "Create cancellation records"),
            ("operation:cancellation:update", "Update", "Update cancellations"),
            ("operation:cancellation:delete", "Delete", "Delete cancellations"),
            ("operation:cancellation:approve", "Approve", "Approve cancellations"),
            ("operation:cancellation:reject", "Reject", "Reject cancellations"),
            ("operation:cancellation:auto-approve", "AutoApprove", "Auto-approve cancellation entries on creation"),
            ("operation:cancellation:allow-back-date", "AllowBackDate", "Allow back-dated cancellation records"),
            ("operation:cancellation:allow-future-date", "AllowFutureDate", "Allow future-dated cancellation records")
        }));

        // ============================================================
        // OPERATION MODULE - Label Printing
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Operation", "LabelPrinting", new[]
        {
            ("operation:label-printing:view", "View", "View label printing requests"),
            ("operation:label-printing:create", "Create", "Create label printing requests"),
            ("operation:label-printing:update", "Update", "Update label printing requests"),
            ("operation:label-printing:delete", "Delete", "Delete label printing requests"),
            ("operation:label-printing:approve", "Approve", "Approve label printing"),
            ("operation:label-printing:reject", "Reject", "Reject label printing"),
            ("operation:label-printing:auto-approve", "AutoApprove", "Auto-approve label print requests on creation"),
            ("operation:label-printing:print", "Print", "Print labels"),
            ("operation:label-printing:allow-back-date", "AllowBackDate", "Allow back-dated label printing"),
            ("operation:label-printing:allow-future-date", "AllowFutureDate", "Allow future-dated label printing")
        }));

        // ============================================================
        // OPERATION MODULE - Showroom Label Printing
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Operation", "ShowroomLabelPrinting", new[]
        {
            ("operation:showroom-label-printing:view", "View", "View showroom label requests"),
            ("operation:showroom-label-printing:create", "Create", "Create showroom label requests"),
            ("operation:showroom-label-printing:edit", "Edit", "Edit showroom label requests"),
            ("operation:showroom-label-printing:delete", "Delete", "Delete showroom label requests"),
            ("operation:showroom-label-printing:print", "Print", "Print showroom labels")
        }));

        // ============================================================
        // PRODUCTION MODULE - Unified Approvals
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Production", "Approvals", new[]
        {
            ("production:approvals:view", "View", "View all production approvals in unified page")
        }));

        // ============================================================
        // PRODUCTION MODULE - Daily Production
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Production", "DailyProduction", new[]
        {
            ("production:daily:view", "View", "View daily production"),
            ("production:daily:create", "Create", "Create production entries"),
            ("production:daily:update", "Update", "Update production entries"),
            ("production:daily:delete", "Delete", "Delete production entries"),
            ("production:daily:approve", "Approve", "Approve production"),
            ("production:daily:reject", "Reject", "Reject production"),
            ("production:daily:auto-approve", "AutoApprove", "Auto-approve daily production entries on creation"),
            ("production:daily:allow-back-date", "AllowBackDate", "Allow back-dated daily production records"),
            ("production:daily:allow-future-date", "AllowFutureDate", "Allow future-dated daily production records")
        }));

        // ============================================================
        // PRODUCTION MODULE - Production Plans
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Production", "ProductionPlan", new[]
        {
            ("production:plan:view", "View", "View production plans"),
            ("production:plan:create", "Create", "Create production plans"),
            ("production:plan:update", "Update", "Update production plans"),
            ("production:plan:delete", "Delete", "Delete production plans"),
            ("production:plan:auto-approve", "AutoApprove", "Auto-approve production plans on creation"),
            ("production:plan:approve", "Approve", "Approve/start/complete production plans"),
            ("production:plan:reject", "Reject", "Reject production plans")
        }));

        // ============================================================
        // PRODUCTION MODULE - Production Cancel
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Production", "ProductionCancel", new[]
        {
            ("production:cancel:view", "View", "View production cancellations"),
            ("production:cancel:create", "Create", "Create production cancellations"),
            ("production:cancel:update", "Update", "Update production cancellations"),
            ("production:cancel:delete", "Delete", "Delete production cancellations"),
            ("production:cancel:approve", "Approve", "Approve production cancellations"),
            ("production:cancel:reject", "Reject", "Reject production cancellations"),
            ("production:cancel:auto-approve", "AutoApprove", "Auto-approve production cancel entries on creation"),
            ("production:cancel:allow-back-date", "AllowBackDate", "Allow back-dated production cancel records"),
            ("production:cancel:allow-future-date", "AllowFutureDate", "Allow future-dated production cancel records")
        }));

        // ============================================================
        // PRODUCTION MODULE - Current Stock
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Production", "CurrentStock", new[]
        {
            ("production:current-stock:view", "View", "View current production stock")
        }));

        // ============================================================
        // PRODUCTION MODULE - Daily Production Plan
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Production", "DailyProductionPlan", new[]
        {
            ("production:daily-plan:view", "View", "View daily production plans"),
            ("production:daily-plan:create", "Create", "Create daily production plans"),
            ("production:daily-plan:update", "Update", "Update daily production plans"),
            ("production:daily-plan:delete", "Delete", "Delete daily production plans"),
            ("production:daily-plan:approve", "Approve", "Approve daily production plans"),
            ("production:daily-plan:reject", "Reject", "Reject daily production plans"),
            ("production:daily-plan:auto-approve", "AutoApprove", "Auto-approve daily production plans on creation")
        }));

        // ============================================================
        // PRODUCTION MODULE - Stock Adjustment
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Production", "StockAdjustment", new[]
        {
            ("production:stock-adjustment:view", "View", "View stock adjustments"),
            ("production:stock-adjustment:create", "Create", "Create stock adjustments"),
            ("production:stock-adjustment:update", "Update", "Update stock adjustments"),
            ("production:stock-adjustment:delete", "Delete", "Delete stock adjustments"),
            ("production:stock-adjustment:approve", "Approve", "Approve stock adjustments"),
            ("production:stock-adjustment:reject", "Reject", "Reject stock adjustments"),
            ("production:stock-adjustment:auto-approve", "AutoApprove", "Auto-approve stock adjustments on creation")
        }));

        // ============================================================
        // PRODUCTION MODULE - Shifts
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Production", "Shifts", new[]
        {
            ("production:shift:view", "View", "View production shifts"),
            ("production:shift:create", "Create", "Create production shifts"),
            ("production:shift:update", "Update", "Update production shifts"),
            ("production:shift:delete", "Delete", "Delete production shifts")
        }));

        // ============================================================
        // PRODUCTION MODULE - Production Sections
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Production", "ProductionSections", new[]
        {
            ("production:view", "View", "View production sections"),
            ("production:create", "Create", "Create production sections"),
            ("production:edit", "Update", "Update production sections"),
            ("production:delete", "Delete", "Delete production sections")
        }));

        // ============================================================
        // DMS MODULE - Order Entry
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("DMS", "OrderEntry", new[]
        {
            ("order:view", "View", "View order entries"),
            ("order:create", "Create", "Create orders"),
            ("order:edit", "Update", "Update orders"),
            ("order:delete", "Delete", "Delete orders")
        }));

        // ============================================================
        // DMS MODULE - Delivery Plan
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("DMS", "DeliveryPlan", new[]
        {
            ("delivery_plan:view", "View", "View delivery plans"),
            ("delivery_plan:create", "Create", "Create delivery plans"),
            ("delivery_plan:edit", "Update", "Update delivery plans"),
            ("delivery_plan:delete", "Delete", "Delete delivery plans"),
            ("delivery_plan:auto-approve", "AutoApprove", "Auto-approve delivery plans on creation")
        }));

        // ============================================================
        // DMS MODULE - Immediate Orders
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("DMS", "ImmediateOrders", new[]
        {
            ("immediate_order:view", "View", "View immediate orders"),
            ("immediate_order:create", "Create", "Create immediate orders"),
            ("immediate_order:edit", "Update", "Update immediate orders"),
            ("immediate_order:delete", "Delete", "Delete immediate orders"),
            ("immediate_order:approve", "Approve", "Approve immediate orders"),
            ("immediate_order:reject", "Reject", "Reject immediate orders"),
            ("immediate_order:auto-approve", "AutoApprove", "Auto-approve immediate orders on creation")
        }));

        // ============================================================
        // DMS MODULE - Default Quantities
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("DMS", "DefaultQuantities", new[]
        {
            ("default_quantity:view", "View", "View default quantities"),
            ("default_quantity:create", "Create", "Create default quantities"),
            ("default_quantity:edit", "Update", "Update default quantities"),
            ("default_quantity:delete", "Delete", "Delete default quantities")
        }));

        // ============================================================
        // DMS MODULE - Production Planner
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("DMS", "ProductionPlanner", new[]
        {
            ("production-planner:view", "View", "View production planner"),
            ("production-planner:create", "Create", "Create/compute production plans"),
            ("production-planner:update", "Update", "Update production plans"),
            ("production-planner:delete", "Delete", "Delete production plans")
        }));

        // ============================================================
        // DMS MODULE - Stores Issue Notes
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("DMS", "StoresIssueNote", new[]
        {
            ("stores-issue-note:view", "View", "View stores issue notes"),
            ("stores-issue-note:create", "Create", "Create/compute stores issue notes"),
            ("stores-issue-note:update", "Update", "Update stores issue notes"),
            ("stores-issue-note:delete", "Delete", "Delete stores issue notes"),
            ("stores-issue-note:execute", "Execute", "Issue/receive stores issue notes"),
            ("stores-issue-note:auto-approve", "AutoApprove", "Auto-approve stores issue notes on creation")
        }));

        // ============================================================
        // DMS MODULE - Recipe Management
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("DMS", "RecipeManagement", new[]
        {
            ("recipes:view", "View", "View recipes"),
            ("recipes:create", "Create", "Create recipes"),
            ("recipes:edit", "Update", "Update recipes"),
            ("recipes:delete", "Delete", "Delete recipes")
        }));

        // ============================================================
        // DMS MODULE - Recipe Templates
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("DMS", "RecipeTemplates", new[]
        {
            ("recipe-templates:view", "View", "View recipe templates"),
            ("recipe-templates:create", "Create", "Create recipe templates"),
            ("recipe-templates:edit", "Update", "Update recipe templates"),
            ("recipe-templates:delete", "Delete", "Delete recipe templates")
        }));

        // ============================================================
        // DMS MODULE - Recipe Plans (Phase B)
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("DMS", "RecipePlans", new[]
        {
            ("recipe-plans:view", "View", "View recipe plans"),
            ("recipe-plans:create", "Create", "Create recipe plans"),
            ("recipe-plans:edit", "Update", "Update recipe plans"),
            ("recipe-plans:delete", "Delete", "Delete recipe plans")
        }));

        // ============================================================
        // DMS MODULE - Freezer Stock
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("DMS", "FreezerStock", new[]
        {
            ("freezer_stock:view", "View", "View freezer stock"),
            ("freezer_stock:edit", "Adjust", "Adjust freezer stock")
        }));

        // ============================================================
        // DMS MODULE - Parent Module Access
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("DMS", "Module", new[]
        {
            ("dms:view", "View", "Access DMS module")
        }));

        // ============================================================
        // DMS MODULE - Anytime Recipe Generator
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("DMS", "AnytimeRecipe", new[]
        {
            ("anytime-recipe:view", "View", "View anytime recipe generator"),
            ("anytime-recipe:generate", "Generate", "Generate anytime recipes")
        }));

        // ============================================================
        // DMS MODULE - Dough Generator (Patties & Rotty)
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("DMS", "DoughGenerator", new[]
        {
            ("dough-generator:view", "View", "View dough generator"),
            ("dough-generator:generate", "Generate", "Generate dough recipes")
        }));

        // ============================================================
        // DMS MODULE - Recipe Export/Upload
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("DMS", "RecipeExport", new[]
        {
            ("dms-recipe:export", "Export", "Export/upload DMS recipes")
        }));

        // ============================================================
        // DMS MODULE - XLSM Importer
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("DMS", "XlsmImporter", new[]
        {
            ("xlsm-importer:view", "View", "View XLSM importer"),
            ("xlsm-importer:import", "Import", "Import XLSM files")
        }));

        // ============================================================
        // DMS MODULE - Reconciliation
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("DMS", "Reconciliation", new[]
        {
            ("reconciliation:view", "View", "View reconciliation"),
            ("reconciliation:perform", "Perform", "Perform reconciliation operations"),
            ("reconciliation:auto-approve", "AutoApprove", "Auto-approve reconciliations on creation")
        }));

        // ============================================================
        // DMS MODULE - Dashboard Pivot
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("DMS", "DashboardPivot", new[]
        {
            ("dashboard-pivot:view", "View", "View pivot dashboard")
        }));

        // ============================================================
        // DMS MODULE - Delivery Summary
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("DMS", "DeliverySummary", new[]
        {
            ("delivery-summary:view", "View", "View delivery summary")
        }));

        // ============================================================
        // DMS MODULE - Print Services
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("DMS", "PrintReceiptCards", new[]
        {
            ("print:receipt-cards", "View", "View/print receipt cards")
        }));

        permissions.AddRange(CreatePermissionsFromCodes("DMS", "SectionPrintBundle", new[]
        {
            ("print:section-bundle", "View", "View/print section bundles")
        }));

        // ============================================================
        // REPORTS MODULE
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Reports", "General", new[]
        {
            ("reports:view", "View", "View all reports"),
            ("reports:export", "Export", "Export reports to PDF/Excel"),
            ("reports:print", "Print", "Print reports"),
            ("reports:allow-back-date", "AllowBackDate", "Allow report dates before the day-end floor")
        }));

        permissions.AddRange(CreatePermissionsFromCodes("Reports", "Sales", new[]
        {
            ("reports:sales:view", "View", "View sales reports")
        }));

        permissions.AddRange(CreatePermissionsFromCodes("Reports", "Production", new[]
        {
            ("reports:production:view", "View", "View production reports")
        }));

        permissions.AddRange(CreatePermissionsFromCodes("Reports", "Inventory", new[]
        {
            ("reports:inventory:view", "View", "View inventory reports")
        }));

        permissions.AddRange(CreatePermissionsFromCodes("Reports", "Financial", new[]
        {
            ("reports:financial:view", "View", "View financial reports")
        }));

        permissions.AddRange(CreatePermissionsFromCodes("Reports", "Delivery", new[]
        {
            ("reports:delivery:view", "View", "View delivery reports")
        }));

        permissions.AddRange(CreatePermissionsFromCodes("Reports", "Disposal", new[]
        {
            ("reports:disposal:view", "View", "View disposal reports")
        }));

        permissions.AddRange(CreatePermissionsFromCodes("Reports", "ImmediateOrders", new[]
        {
            ("reports:immediate-orders:view", "View", "View immediate orders summary report")
        }));

        permissions.AddRange(CreatePermissionsFromCodes("Reports", "Product", new[]
        {
            ("reports:product:view", "View", "View product-wise reports")
        }));

        permissions.AddRange(CreatePermissionsFromCodes("Reports", "Showroom", new[]
        {
            ("reports:showroom:view", "View", "View showroom-wise reports")
        }));

        permissions.AddRange(CreatePermissionsFromCodes("Reports", "Category", new[]
        {
            ("reports:category:view", "View", "View category-wise reports")
        }));

        permissions.AddRange(CreatePermissionsFromCodes("Reports", "Daily", new[]
        {
            ("reports:daily:view", "View", "View daily summary reports")
        }));

        permissions.AddRange(CreatePermissionsFromCodes("Reports", "Monthly", new[]
        {
            ("reports:monthly:view", "View", "View monthly summary reports")
        }));

        permissions.AddRange(CreatePermissionsFromCodes("Reports", "Profit", new[]
        {
            ("reports:profit:view", "View", "View profit & loss reports")
        }));

        // ============================================================
        // SYSTEM MODULE - Audit & Logs
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("System", "AuditLogs", new[]
        {
            ("audit-logs:view", "View", "View audit logs"),
            ("audit-logs:export", "Export", "Export audit logs")
        }));

        permissions.AddRange(CreatePermissionsFromCodes("System", "SystemLogs", new[]
        {
            ("system-logs:view", "View", "View system logs"),
            ("system-logs:export", "Export", "Export system logs")
        }));

        // ============================================================
        // DASHBOARD MODULE
        // ============================================================
        permissions.AddRange(CreatePermissionsFromCodes("Dashboard", "Main", new[]
        {
            ("dashboard:view", "View", "View main dashboard")
        }));

        // ============================================================
        // FULL ACTION FAN-OUT
        // ------------------------------------------------------------
        // Mirrors `fillActions(prefix, ...)` in the frontend
        // permission-map.ts. For every (prefix, parent, sub) tuple
        // below we emit all 13 standard ActionKeys so the Roles &
        // Permissions matrix shows a checkbox in every cell instead
        // of a dash. Codes that already exist (e.g. the explicit
        // `operation:delivery:update` for `edit`) are deduped above
        // and never re-inserted by this seeder, so the historical
        // permission codes survive untouched.
        // ============================================================
        permissions.AddRange(BuildFullActionFanOut());

        return permissions;
    }

    /// <summary>
    /// One row per (prefix, parentModule, subModule). Every prefix is
    /// expanded into the 13 standard ActionKey codes by
    /// <see cref="CreateAllActionCodes"/>.
    /// </summary>
    private static readonly (string Prefix, string ParentModule, string SubModule)[] AllActionPrefixes = new[]
    {
        // Dashboard
        ("dashboard", "Dashboard", "Main"),

        // Inventory
        ("products", "Inventory", "Products"),
        ("categories", "Inventory", "Categories"),
        ("unit-of-measure", "Inventory", "UnitOfMeasure"),
        ("ingredients", "Inventory", "Ingredients"),

        // Showroom
        ("showroom", "Showroom", "Outlets"),

        // Operation
        ("operation:delivery", "Operation", "Delivery"),
        ("operation:delivery-return", "Operation", "DeliveryReturn"),
        ("operation:disposal", "Operation", "Disposal"),
        ("operation:transfer", "Operation", "Transfer"),
        ("pos", "Operation", "PosSale"),
        ("operation:stock-bf", "Operation", "StockBF"),
        ("operation:cancellation", "Operation", "Cancellation"),
        ("operation:label-printing", "Operation", "LabelPrinting"),
        ("operation:showroom-label-printing", "Operation", "ShowroomLabelPrinting"),
        ("operation:approvals", "Operation", "Approvals"),

        // Production
        ("production:daily", "Production", "DailyProduction"),
        ("production:approvals", "Production", "Approvals"),
        ("production:cancel", "Production", "ProductionCancel"),
        ("production:plan", "Production", "ProductionPlan"),
        ("production:current-stock", "Production", "CurrentStock"),
        ("production:stock-adjustment", "Production", "StockAdjustment"),
        ("production:shift", "Production", "Shifts"),

        // DMS
        ("order", "DMS", "OrderEntry"),
        ("delivery_plan", "DMS", "DeliveryPlan"),
        ("delivery-summary", "DMS", "DeliverySummary"),
        ("immediate_order", "DMS", "ImmediateOrders"),
        ("default_quantity", "DMS", "DefaultQuantities"),
        ("production-planner", "DMS", "ProductionPlanner"),
        ("stores-issue-note", "DMS", "StoresIssueNote"),
        ("recipes", "DMS", "RecipeManagement"),
        ("recipe-templates", "DMS", "RecipeTemplates"),
        ("freezer_stock", "DMS", "FreezerStock"),
        ("anytime-recipe", "DMS", "AnytimeRecipe"),
        ("dough-generator", "DMS", "DoughGenerator"),
        ("dms-recipe", "DMS", "RecipeExport"),
        ("dashboard-pivot", "DMS", "DashboardPivot"),
        ("print:receipt-cards", "DMS", "PrintReceiptCards"),
        ("print:section-bundle", "DMS", "SectionPrintBundle"),
        ("xlsm-importer", "DMS", "XlsmImporter"),
        ("reconciliation", "DMS", "Reconciliation"),

        // Reports
        ("reports", "Reports", "General"),
        ("reports:sales", "Reports", "Sales"),
        ("reports:delivery", "Reports", "Delivery"),
        ("reports:disposal", "Reports", "Disposal"),
        ("reports:inventory", "Reports", "Inventory"),
        ("reports:product", "Reports", "Product"),
        ("reports:showroom", "Reports", "Showroom"),
        ("reports:category", "Reports", "Category"),
        ("reports:daily", "Reports", "Daily"),
        ("reports:monthly", "Reports", "Monthly"),
        ("reports:profit", "Reports", "Profit"),
        ("reports:financial", "Reports", "Financial"),
        ("reports:production", "Reports", "Production"),

        // Administrator
        ("day-end", "Administrator", "DayEndProcess"),
        ("pos:sale-records", "Operation", "PosSaleRecords"),
        ("cashier-balance", "Administrator", "CashierBalance"),
        ("setting", "Administrator", "SystemSettings"),
        ("label-settings", "Administrator", "LabelSettings"),
        ("admin-delivery-plan", "Administrator", "AdminDeliveryPlan"),
        ("security-policies", "Administrator", "Security"),
        ("users", "Administrator", "Users"),
        ("roles", "Administrator", "Roles"),
        ("permissions", "Administrator", "Permissions"),
        ("admin", "Administrator", "DayLock"),
        ("approval", "Administrator", "Approvals"),
        ("employee", "Administrator", "ShowroomEmployee"),
        ("pricing", "Administrator", "PriceManager"),
        ("workflow-config", "Administrator", "WorkflowConfig"),
        ("grid-config", "Administrator", "GridConfiguration"),
        ("day_type", "Administrator", "DayTypes"),
        ("delivery_turn", "Administrator", "DeliveryTurns"),
        ("rounding-rules", "Administrator", "RoundingRules"),
        ("section-consumables", "Administrator", "SectionConsumables"),
        ("label-templates", "Administrator", "LabelTemplates"),
    };

    /// <summary>
    /// The full set of action suffixes (and their friendly labels) that the
    /// frontend role permissions matrix shows as columns. Mirrors
    /// `ACTION_CODE_SUFFIX` and `ACTION_LABELS` in permission-map.ts.
    /// </summary>
    private static readonly (string Suffix, string Action)[] AllActionSuffixes = new[]
    {
        ("view", "View"),
        ("create", "Create"),
        ("edit", "Update"),
        ("delete", "Delete"),
        ("approve", "Approve"),
        ("reject", "Reject"),
        ("print", "Print"),
        ("import", "Import"),
        ("export", "Export"),
        ("execute", "Execute"),
        ("generate", "Generate"),
        ("lock", "Lock"),
        ("allow-back-date", "AllowBackDate"),
        ("allow-future-date", "AllowFutureDate"),
    };

    private List<Permission> BuildFullActionFanOut()
    {
        var result = new List<Permission>(AllActionPrefixes.Length * AllActionSuffixes.Length);

        foreach (var (prefix, parentModule, subModule) in AllActionPrefixes)
        {
            var codes = AllActionSuffixes
                .Select(a => ($"{prefix}:{a.Suffix}", a.Action, $"{a.Action} {subModule}"))
                .ToArray();

            result.AddRange(CreatePermissionsFromCodes(parentModule, subModule, codes));
        }

        return result;
    }

    private List<Permission> CreatePermissionsFromCodes(string parentModule, string subModule, (string Code, string Action, string Description)[] permissionData)
    {
        var permissions = new List<Permission>();

        foreach (var (code, action, description) in permissionData)
        {
            var name = $"{action} {subModule}";

            var permission = new Permission
            {
                Id = Guid.NewGuid(),
                Code = code, // Use the exact code that controllers check for
                Name = name,
                Module = $"{parentModule} - {subModule}", // Use dash separator instead of dot to avoid grouping issues
                Description = description,
                IsSystemPermission = true,
                CreatedAt = DateTimeOffset.UtcNow,
                DisplayOrder = _displayOrder++
            };

            permissions.Add(permission);
        }

        return permissions;
    }
}
