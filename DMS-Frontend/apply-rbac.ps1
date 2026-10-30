# PowerShell Script to Apply RBAC to Pages
# Usage: .\apply-rbac.ps1

Write-Host "🔒 RBAC Application Helper Script" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Permission mapping based on menu-items.ts
$permissionMap = @{
    # Inventory
    "inventory/products/page.tsx" = "inventory.products.view"
    "inventory/category/page.tsx" = "inventory.category.view"
    "inventory/uom/page.tsx" = "inventory.uom.view"
    "inventory/ingredient/page.tsx" = "inventory.ingredient.view"
    
    # Showroom
    "showroom/page.tsx" = "showroom.view"
    
    # Operation
    "operation/delivery/page.tsx" = "operation.delivery.view"
    "operation/disposal/page.tsx" = "operation.disposal.view"
    "operation/transfer/page.tsx" = "operation.transfer.view"
    "operation/stock-bf/page.tsx" = "operation.stock-bf.view"
    "operation/cancellation/page.tsx" = "operation.cancellation.view"
    "operation/delivery-return/page.tsx" = "operation.delivery-return.view"
    "operation/label-printing/page.tsx" = "operation.label-printing.view"
    "operation/showroom-label-printing/page.tsx" = "operation.showroom-label-printing.view"
    
    # Production
    "production/daily-production/page.tsx" = "production.daily.view"
    "production/production-cancel/page.tsx" = "production.cancel.view"
    "production/current-stock/page.tsx" = "production.stock.view"
    "production/production-plan/page.tsx" = "production.plan.view"
    
    # DMS
    "dms/order-entry-enhanced/page.tsx" = "dms.order-entry.view"
    "dms/delivery-plan/page.tsx" = "dms.delivery-plan.view"
    "dms/delivery-summary/page.tsx" = "dms.delivery-summary.view"
    "dms/immediate-orders/page.tsx" = "dms.immediate-orders.view"
    "dms/default-quantities/page.tsx" = "dms.default-quantities.view"
    "dms/production-planner-enhanced/page.tsx" = "dms.production-planner.view"
    "dms/stores-issue-note-enhanced/page.tsx" = "dms.stores-issue-note.view"
    "dms/recipe-management/page.tsx" = "dms.recipe-management.view"
    "dms/recipe-templates/page.tsx" = "dms.recipe-templates.view"
    "dms/freezer-stock/page.tsx" = "dms.freezer-stock.view"
    "dms/anytime-recipe-generator/page.tsx" = "dms.anytime-recipe.view"
    "dms/dashboard-pivot/page.tsx" = "dms.dashboard-pivot.view"
    "dms/print-receipt-cards/page.tsx" = "dms.print.view"
    "dms/section-print-bundle/page.tsx" = "dms.print.view"
    "dms/dms-recipe-upload/page.tsx" = "dms.export.view"
    "dms/reconciliation/page.tsx" = "dms.reconciliation.view"
    "dms/importer/page.tsx" = "dms.importer.view"
    
    # Reports
    "reports/page.tsx" = "reports.view"
    
    # Administrator
    "administrator/day-end-process/page.tsx" = "administrator.day-end.view"
    "administrator/cashier-balance/page.tsx" = "administrator.cashier-balance.view"
    "administrator/system-settings/page.tsx" = "administrator.settings.view"
    "administrator/label-settings/page.tsx" = "administrator.label-settings.view"
    "administrator/label-key-settings/page.tsx" = "administrator.label-settings.view"
    "administrator/label-key-settings/add/page.tsx" = "administrator.label-settings.view"
    "administrator/label-key-settings/edit/[id]/page.tsx" = "administrator.label-settings.view"
    "administrator/delivery-plan/page.tsx" = "administrator.delivery-plan.view"
    "administrator/security/page.tsx" = "administrator.security.view"
    "administrator/users/page.tsx" = "administrator.users.view"
    "administrator/roles/page.tsx" = "administrator.roles.view"
    "administrator/permissions/page.tsx" = "administrator.permissions.view"
    "administrator/day-lock/page.tsx" = "administrator.day-lock.view"
    "administrator/approvals/page.tsx" = "administrator.approvals.view"
    "administrator/showroom-employee/page.tsx" = "administrator.showroom-employee.view"
    "administrator/price-manager/page.tsx" = "administrator.price-manager.view"
    "administrator/workflow-config/page.tsx" = "administrator.workflow-config.view"
    "administrator/grid-configuration/page.tsx" = "administrator.grid-config.view"
    "administrator/day-types/page.tsx" = "administrator.day-types.view"
    "administrator/delivery-turns/page.tsx" = "administrator.delivery-turns.view"
    "administrator/rounding-rules/page.tsx" = "administrator.rounding.view"
    "administrator/section-consumables/page.tsx" = "administrator.consumables.view"
    "administrator/label-templates/page.tsx" = "administrator.label-templates.view"
}

$basePath = "src\app\(dashboard)"

Write-Host "📊 Scanning pages..." -ForegroundColor Yellow
Write-Host ""

$protected = 0
$unprotected = 0
$total = 0

foreach ($relativePath in $permissionMap.Keys) {
    $fullPath = Join-Path $basePath $relativePath
    
    if (Test-Path $fullPath) {
        $total++
        $content = Get-Content $fullPath -Raw
        
        if ($content -match "ProtectedPage") {
            Write-Host "✅ $relativePath" -ForegroundColor Green
            $protected++
        } else {
            Write-Host "⚠️  $relativePath - Permission: $($permissionMap[$relativePath])" -ForegroundColor Yellow
            $unprotected++
        }
    }
}

Write-Host ""
Write-Host "📈 Summary:" -ForegroundColor Cyan
Write-Host "  Total pages checked: $total" -ForegroundColor White
Write-Host "  Protected: $protected" -ForegroundColor Green
Write-Host "  Unprotected: $unprotected" -ForegroundColor Yellow
Write-Host ""

if ($unprotected -gt 0) {
    Write-Host "💡 Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Open each unprotected page file" -ForegroundColor White
    Write-Host "  2. Add 'use client' directive at the top" -ForegroundColor White
    Write-Host "  3. Import: import { ProtectedPage } from '@/components/auth';" -ForegroundColor White
    Write-Host "  4. Wrap the content with <ProtectedPage permission='...'>" -ForegroundColor White
    Write-Host ""
    Write-Host "  See APPLY_RBAC_TO_ALL_PAGES.md for detailed instructions" -ForegroundColor Cyan
} else {
    Write-Host "🎉 All pages are protected!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
