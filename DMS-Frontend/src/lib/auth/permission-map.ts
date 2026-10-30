/**
 * Canonical Permission Map for Don & Sons DMS
 *
 * SINGLE SOURCE OF TRUTH for:
 *   1. Sidebar navigation structure
 *   2. Role/permission administration UI
 *   3. Page-level and button-level guards
 *
 * IMPORTANT: All permission codes use COLON notation (matching the backend
 * `[HasPermission("...")]` attributes and the seeded `Permission.Code` values).
 *
 *   Format examples:
 *     "products:view", "products:create", "products:edit", "products:delete"
 *     "operation:delivery:view", "operation:delivery:approve"
 *
 * Adding a new feature?
 *   1. Add a subsection here with its actions.
 *   2. Add the matching permission codes to the backend ComprehensivePermissionSeeder.
 *   3. Decorate the controller(s) with [HasPermission("…")] using the same codes.
 *
 * Every subsection now exposes the FULL set of `ActionKey` columns in the
 * Roles & Permissions admin UI. The `fillActions(prefix, overrides)` helper
 * derives `${prefix}:${suffix}` for any action that doesn't have an explicit
 * code — so the matrix shows a checkbox in every cell instead of a dash.
 */

import {
  Archive,
  ArrowLeftRight,
  Box,
  Calendar,
  CalendarDays,
  Calculator,
  CheckSquare,
  ChefHat,
  ClipboardList,
  Clock,
  CornerUpLeft,
  Database,
  DollarSign,
  FileBarChart,
  FileStack,
  FileText,
  Grid,
  KeyRound,
  Factory,
  LayoutDashboard,
  Layers,
  Lock,
  Package,
  Palette,
  Printer,
  Terminal,
  Settings,
  Shield,
  ShoppingCart,
  Snowflake,
  Store,
  Tag,
  Trash2,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  Workflow,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Standard CRUD action keys plus workflow / extra actions.
 * Only the keys present on a subsection are surfaced in the UI.
 */
export type ActionKey =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'autoApprove'
  | 'print'
  | 'import'
  | 'export'
  | 'execute'
  | 'generate'
  | 'lock'
  | 'notify'
  | 'allowBackDate'
  | 'allowFutureDate';

export interface SubsectionDef {
  /** Stable identifier (used as React key, slug). */
  id: string;
  /** Display name (also used in sidebar). */
  name: string;
  /** Route for the page (omit for non-navigable items). */
  href?: string;
  /** Lucide icon. */
  icon: LucideIcon;
  /**
   * Map of action -> backend permission code.
   * Only present actions are shown in the role permissions UI.
   * `view` should generally be defined; it controls sidebar visibility.
   */
  actions: Partial<Record<ActionKey, string>>;
  /** Hide from sidebar (still used for permission management). */
  hideFromSidebar?: boolean;
  /** Only Super Admins see this in the sidebar. */
  superAdminOnly?: boolean;
  /** Optional badge for sidebar. */
  badge?: string | number;
}

export interface SectionDef {
  id: string;
  name: string;
  icon: LucideIcon;
  /**
   * Optional permission required to expand the section in the sidebar.
   * If omitted, the section is visible whenever any subsection is visible.
   */
  modulePermission?: string;
  /** Hide the whole section from the sidebar. */
  hideFromSidebar?: boolean;
  /** Hide the whole section from the roles & permissions matrix. */
  hideFromPermissions?: boolean;
  subsections: SubsectionDef[];
}

/**
 * Friendly labels for action columns in the role permissions UI.
 */
export const ACTION_LABELS: Record<ActionKey, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  approve: 'Approve',
  reject: 'Reject',
  autoApprove: 'Auto Approve',
  print: 'Print',
  import: 'Import',
  export: 'Export',
  execute: 'Execute',
  generate: 'Generate',
  lock: 'Lock',
  notify: 'Notify',
  allowBackDate: 'Back Date',
  allowFutureDate: 'Future Date',
};

/**
 * Order columns appear in the permissions UI.
 */
export const ACTION_ORDER: ActionKey[] = [
  'view',
  'create',
  'edit',
  'delete',
  'approve',
  'reject',
  'autoApprove',
  'print',
  'export',
  'import',
  'execute',
  'generate',
  'lock',
  'allowBackDate',
  'allowFutureDate',
];

/**
 * Suffix appended to a subsection's `prefix` when generating a default
 * permission code for an `ActionKey` (used by `fillActions`).
 */
const ACTION_CODE_SUFFIX: Record<ActionKey, string> = {
  view: 'view',
  create: 'create',
  edit: 'edit',
  delete: 'delete',
  approve: 'approve',
  reject: 'reject',
  autoApprove: 'auto-approve',
  print: 'print',
  import: 'import',
  export: 'export',
  execute: 'execute',
  generate: 'generate',
  lock: 'lock',
  notify: 'notify',
  allowBackDate: 'allow-back-date',
  allowFutureDate: 'allow-future-date',
};

/**
 * Build a complete `ActionKey -> permission code` map for a subsection.
 *
 * Any `overrides` win (so historical codes like `operation:delivery:update`
 * for the `edit` action stay intact). Every other action falls back to
 * `${prefix}:${ACTION_CODE_SUFFIX[key]}`. The result always contains all
 * `ActionKey`s — guaranteeing the role permissions matrix shows a checkbox
 * for every cell instead of a dash.
 */
export function fillActions(
  prefix: string,
  overrides: Partial<Record<ActionKey, string>> = {}
): Partial<Record<ActionKey, string>> {
  const result: Partial<Record<ActionKey, string>> = {};
  for (const key of ACTION_ORDER) {
    result[key] = overrides[key] ?? `${prefix}:${ACTION_CODE_SUFFIX[key]}`;
  }
  return result;
}

const DATE_KEYS: ActionKey[] = ['allowBackDate', 'allowFutureDate'];

/**
 * Like `fillActions` but omits Back Date / Future Date columns.
 * Use for sections where date-override access doesn't apply (dashboard, settings, reports, etc.).
 */
export function fillCoreActions(
  prefix: string,
  overrides: Partial<Record<ActionKey, string>> = {}
): Partial<Record<ActionKey, string>> {
  const result: Partial<Record<ActionKey, string>> = {};
  for (const key of ACTION_ORDER) {
    if (DATE_KEYS.includes(key)) continue;
    result[key] = overrides[key] ?? `${prefix}:${ACTION_CODE_SUFFIX[key]}`;
  }
  return result;
}

// ---------------------------------------------------------------------------
//                            PERMISSION CATALOG
// ---------------------------------------------------------------------------

export const PERMISSION_SECTIONS: SectionDef[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    icon: LayoutDashboard,
    subsections: [
      {
        id: 'dashboard-main',
        name: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        actions: fillCoreActions('dashboard'),
      },
    ],
  },

  // -------------------------------------------------------------------------
  //                            INVENTORY
  // -------------------------------------------------------------------------
  {
    id: 'inventory',
    name: 'Inventory',
    icon: Package,
    subsections: [
      {
        id: 'products',
        name: 'Products',
        href: '/inventory/products',
        icon: Package,
        actions: fillCoreActions('products'),
      },
      {
        id: 'categories',
        name: 'Category',
        href: '/inventory/category',
        icon: Tag,
        actions: fillCoreActions('categories'),
      },
      {
        id: 'unit-of-measure',
        name: 'Unit of Measure',
        href: '/inventory/uom',
        icon: Layers,
        actions: fillCoreActions('unit-of-measure'),
      },
      {
        id: 'ingredients',
        name: 'Ingredient',
        href: '/inventory/ingredient',
        icon: Archive,
        actions: fillCoreActions('ingredients'),
      },
    ],
  },

  // -------------------------------------------------------------------------
  //                            SHOWROOM
  // -------------------------------------------------------------------------
  {
    id: 'showroom',
    name: 'Showrooms',
    icon: Store,
    subsections: [
      {
        id: 'showroom',
        name: 'Showrooms',
        href: '/showroom',
        icon: Store,
        actions: fillCoreActions('showroom'),
      },
    ],
  },

  // -------------------------------------------------------------------------
  //                            OPERATION
  // -------------------------------------------------------------------------
  {
    id: 'operation',
    name: 'Operation',
    icon: ClipboardList,
    subsections: [
      {
        id: 'operation-delivery',
        name: 'Delivery',
        href: '/operation/delivery',
        icon: Truck,
        actions: fillActions('operation:delivery', {
          edit: 'operation:delivery:update',
        }),
      },
      {
        id: 'operation-approvals',
        name: 'All Approvals',
        href: '/operation/approvals',
        icon: CheckSquare,
        actions: fillCoreActions('operation:approvals'),
        /** Unified queue lives under Administrator → Approvals; URL redirects. */
        hideFromSidebar: true,
      },
      {
        id: 'operation-disposal',
        name: 'Disposal',
        href: '/operation/disposal',
        icon: Trash2,
        actions: fillActions('operation:disposal', {
          edit: 'operation:disposal:update',
        }),
      },
      {
        id: 'operation-transfer',
        name: 'Transfer',
        href: '/operation/transfer',
        icon: ArrowLeftRight,
        actions: fillActions('operation:transfer', {
          edit: 'operation:transfer:update',
        }),
      },
      {
        id: 'operation-stock-bf',
        name: 'Stock BF',
        href: '/operation/stock-bf',
        icon: Archive,
        actions: fillActions('operation:stock-bf', {
          edit: 'operation:stock-bf:update',
        }),
      },
      {
        id: 'operation-cancellation',
        name: 'Cancellation',
        href: '/operation/cancellation',
        icon: XCircle,
        actions: fillActions('operation:cancellation', {
          edit: 'operation:cancellation:update',
        }),
      },
      {
        id: 'operation-delivery-return',
        name: 'Delivery Return',
        href: '/operation/delivery-return',
        icon: CornerUpLeft,
        actions: fillActions('operation:delivery-return', {
          edit: 'operation:delivery-return:update',
        }),
      },
      {
        id: 'operation-label-printing',
        name: 'Label Printing',
        href: '/operation/label-printing',
        icon: Printer,
        actions: fillActions('operation:label-printing', {
          edit: 'operation:label-printing:update',
        }),
      },
      {
        id: 'operation-showroom-label-printing',
        name: 'Showroom Label Printing',
        href: '/operation/showroom-label-printing',
        icon: Printer,
        actions: fillCoreActions('operation:showroom-label-printing'),
      },
    ],
  },

  // -------------------------------------------------------------------------
  //                            PRODUCTION
  // -------------------------------------------------------------------------
  {
    id: 'production',
    name: 'Production',
    icon: Factory,
    subsections: [
      {
        id: 'production-daily',
        name: 'Daily Production',
        href: '/production/daily-production',
        icon: Factory,
        actions: fillActions('production:daily', {
          edit: 'production:daily:update',
        }),
      },
      {
        id: 'production-approvals',
        name: 'All Approvals',
        href: '/production/approvals',
        icon: CheckSquare,
        actions: fillCoreActions('production:approvals'),
        /** Unified queue lives under Administrator → Approvals; URL redirects. */
        hideFromSidebar: true,
      },
      {
        id: 'production-cancel',
        name: 'Production Cancel',
        href: '/production/production-cancel',
        icon: XCircle,
        actions: fillActions('production:cancel', {
          edit: 'production:cancel:update',
        }),
      },
      {
        id: 'production-current-stock',
        name: 'Current Stock',
        href: '/production/current-stock',
        icon: Box,
        actions: fillCoreActions('production:current-stock'),
      },
      {
        id: 'production-stock-adjustment',
        name: 'Stock Adjustment',
        href: '/production/stock-adjustment',
        icon: Archive,
        actions: fillCoreActions('production:stock-adjustment', {
          edit: 'production:stock-adjustment:update',
        }),
      },
      {
        id: 'production-stock-adjustment-approval',
        name: 'Stock Adjustment Approval',
        href: '/production/stock-adjustment-approval',
        icon: CheckSquare,
        actions: fillCoreActions('production:stock-adjustment', {
          view: 'production:stock-adjustment:approve',
          edit: 'production:stock-adjustment:update',
        }),
      },
      {
        id: 'production-plan',
        name: 'Production Plan',
        href: '/production/production-plan',
        icon: ClipboardList,
        actions: fillCoreActions('production:plan', {
          edit: 'production:plan:update',
        }),
      },
    ],
  },

  // -------------------------------------------------------------------------
  //                                DMS
  // -------------------------------------------------------------------------
  {
    id: 'dms',
    name: 'DMS',
    icon: Grid,
    modulePermission: 'dms:view',
    subsections: [
      {
        id: 'dms-order-entry',
        name: 'Order Entry',
        href: '/dms/order-entry-enhanced',
        icon: Grid,
        actions: fillCoreActions('order'),
      },
      {
        id: 'dms-delivery-plan',
        name: 'Delivery Plan',
        href: '/dms/delivery-plan',
        icon: Calendar,
        actions: fillCoreActions('delivery_plan'),
      },
      {
        id: 'dms-delivery-summary',
        name: 'Delivery Summary',
        href: '/dms/delivery-summary',
        icon: FileBarChart,
        actions: fillCoreActions('delivery-summary'),
      },
      {
        id: 'dms-immediate-orders',
        name: 'Immediate Orders',
        href: '/dms/immediate-orders',
        icon: Zap,
        actions: fillCoreActions('immediate_order'),
      },
      {
        id: 'dms-default-quantities',
        name: 'Default Quantities',
        href: '/dms/default-quantities',
        icon: Database,
        actions: fillCoreActions('default_quantity'),
      },
      {
        id: 'dms-production-planner',
        name: 'Production Planner',
        href: '/dms/production-planner-enhanced',
        icon: ChefHat,
        actions: fillCoreActions('production-planner', {
          edit: 'production-planner:update',
        }),
      },
      {
        id: 'dms-stores-issue-note',
        name: 'Stores Issue Note',
        href: '/dms/stores-issue-note-enhanced',
        icon: FileText,
        actions: fillCoreActions('stores-issue-note', {
          edit: 'stores-issue-note:update',
        }),
      },
      {
        id: 'dms-recipe-management',
        name: 'Recipe Management',
        href: '/dms/recipe-management',
        icon: ClipboardList,
        actions: fillCoreActions('recipes'),
      },
      {
        id: 'dms-recipe-templates',
        name: 'Recipe Templates',
        href: '/dms/recipe-templates',
        icon: FileStack,
        actions: fillCoreActions('recipe-templates'),
      },
      {
        id: 'dms-freezer-stock',
        name: 'Freezer Stock',
        href: '/dms/freezer-stock',
        icon: Snowflake,
        actions: fillCoreActions('freezer_stock'),
      },
      {
        id: 'dms-anytime-recipe',
        name: 'Anytime Recipe',
        href: '/dms/anytime-recipe-generator',
        icon: Zap,
        actions: fillCoreActions('anytime-recipe'),
      },
      {
        id: 'dms-dough-patties',
        name: 'Patties Dough',
        href: '/dms/dough-generator/patties',
        icon: ChefHat,
        actions: fillCoreActions('dough-generator'),
      },
      {
        id: 'dms-dough-rotty',
        name: 'Rotty Dough',
        href: '/dms/dough-generator/rotty',
        icon: ChefHat,
        actions: fillCoreActions('dough-generator'),
      },
      {
        id: 'dms-dashboard-pivot',
        name: 'Pivot Dashboard',
        href: '/dms/dashboard-pivot',
        icon: FileBarChart,
        actions: fillCoreActions('dashboard-pivot'),
      },
      {
        id: 'dms-receipt-cards',
        name: 'Receipt Cards',
        href: '/dms/print-receipt-cards',
        icon: Printer,
        actions: fillCoreActions('print:receipt-cards', {
          // Historical: a single permission gates both the page view and the
          // print action.
          view: 'print:receipt-cards',
          print: 'print:receipt-cards',
        }),
      },
      {
        id: 'dms-section-print-bundle',
        name: 'Section Print Bundle',
        href: '/dms/section-print-bundle',
        icon: Printer,
        actions: fillCoreActions('print:section-bundle', {
          view: 'print:section-bundle',
          print: 'print:section-bundle',
        }),
      },
      {
        id: 'dms-recipe-upload',
        name: 'DMS Recipe Upload',
        href: '/dms/dms-recipe-upload',
        icon: FileText,
        actions: fillCoreActions('dms-recipe', {
          // Historical: a single permission gates view + export.
          view: 'dms-recipe:export',
          export: 'dms-recipe:export',
        }),
      },
      {
        id: 'dms-reconciliation',
        name: 'Reconciliation',
        href: '/dms/reconciliation',
        icon: CheckSquare,
        actions: fillCoreActions('reconciliation', {
          execute: 'reconciliation:perform',
        }),
      },
      {
        id: 'dms-importer',
        name: 'xlsm Importer',
        href: '/dms/importer',
        icon: Database,
        actions: fillCoreActions('xlsm-importer'),
      },
    ],
  },

  // -------------------------------------------------------------------------
  //                              REPORTS
  // -------------------------------------------------------------------------
  {
    id: 'reports',
    name: 'Reports',
    icon: FileText,
    subsections: [
      {
        id: 'reports-main',
        name: 'Reports',
        href: '/reports',
        icon: FileText,
        actions: fillCoreActions('reports'),
      },
      {
        id: 'reports-sales',
        name: 'Sales Report',
        icon: FileText,
        hideFromSidebar: true,
        actions: fillCoreActions('reports:sales'),
      },
      {
        id: 'reports-delivery',
        name: 'Delivery Report',
        icon: FileText,
        hideFromSidebar: true,
        actions: fillCoreActions('reports:delivery'),
      },
      {
        id: 'reports-disposal',
        name: 'Disposal Report',
        icon: FileText,
        hideFromSidebar: true,
        actions: fillCoreActions('reports:disposal'),
      },
      {
        id: 'reports-inventory',
        name: 'Inventory Report',
        icon: FileText,
        hideFromSidebar: true,
        actions: fillCoreActions('reports:inventory'),
      },
      {
        id: 'reports-product',
        name: 'Product Wise Report',
        icon: FileText,
        hideFromSidebar: true,
        actions: fillCoreActions('reports:product'),
      },
      {
        id: 'reports-showroom',
        name: 'Showroom Wise Report',
        icon: FileText,
        hideFromSidebar: true,
        actions: fillCoreActions('reports:showroom'),
      },
      {
        id: 'reports-category',
        name: 'Category Wise Report',
        icon: FileText,
        hideFromSidebar: true,
        actions: fillCoreActions('reports:category'),
      },
      {
        id: 'reports-daily',
        name: 'Daily Summary',
        icon: FileText,
        hideFromSidebar: true,
        actions: fillCoreActions('reports:daily'),
      },
      {
        id: 'reports-monthly',
        name: 'Monthly Summary',
        icon: FileText,
        hideFromSidebar: true,
        actions: fillCoreActions('reports:monthly'),
      },
      {
        id: 'reports-profit',
        name: 'Profit & Loss',
        icon: FileText,
        hideFromSidebar: true,
        actions: fillCoreActions('reports:profit'),
      },
      {
        id: 'reports-financial',
        name: 'Financial Reports',
        icon: FileText,
        hideFromSidebar: true,
        actions: fillCoreActions('reports:financial'),
      },
      {
        id: 'reports-production',
        name: 'Production Reports',
        icon: FileText,
        hideFromSidebar: true,
        actions: fillCoreActions('reports:production'),
      },
    ],
  },

  // -------------------------------------------------------------------------
  //                            ADMINISTRATOR
  // -------------------------------------------------------------------------
  {
    id: 'administrator',
    name: 'Administrator',
    icon: Settings,
    modulePermission: 'administrator:view',
    subsections: [
      {
        id: 'admin-day-end',
        name: 'Day-End Process',
        href: '/administrator/day-end-process',
        icon: CalendarDays,
        actions: {
          ...fillActions('day-end'),
          notify: 'day-end:notify',
        },
      },
      {
        id: 'admin-cashier-balance',
        name: 'Cashier Balance',
        href: '/administrator/cashier-balance',
        icon: DollarSign,
        actions: fillActions('cashier-balance'),
      },
      {
        id: 'admin-system-settings',
        name: 'System Settings',
        href: '/administrator/system-settings',
        icon: Settings,
        actions: fillCoreActions('setting'),
      },
      {
        id: 'admin-auto-approval',
        name: 'Auto-Approval Settings',
        href: '/administrator/auto-approval',
        icon: Settings,
        actions: fillCoreActions('auto-approval-config'),
      },
      {
        id: 'admin-label-settings',
        name: 'Label Settings',
        href: '/administrator/label-settings',
        icon: Printer,
        actions: fillCoreActions('label-settings'),
      },
      {
        id: 'admin-label-key-settings',
        name: 'Label Key Settings',
        href: '/administrator/label-key-settings',
        icon: Settings,
        hideFromSidebar: true,
        actions: fillCoreActions('label-settings'),
      },
      {
        id: 'admin-label-templates-inline',
        name: 'Label Templates',
        href: '/administrator/label-templates',
        icon: FileText,
        actions: fillCoreActions('label-templates'),
      },
      {
        id: 'admin-delivery-plan',
        name: 'Delivery Plan',
        href: '/administrator/delivery-plan',
        icon: ClipboardList,
        actions: fillActions('admin-delivery-plan'),
      },
      {
        id: 'admin-security',
        name: 'Security',
        href: '/administrator/security',
        icon: Shield,
        actions: fillCoreActions('security-policies'),
      },
      {
        /** Reached from Security; omit duplicate sidebar links. */
        id: 'admin-users',
        name: 'Users',
        href: '/administrator/users',
        icon: Users,
        hideFromSidebar: true,
        actions: fillCoreActions('users', {
          // Historical: users uses :read / :update instead of :view / :edit.
          view: 'users:read',
          edit: 'users:update',
        }),
      },
      {
        /** Reached from Security; omit duplicate sidebar links. */
        id: 'admin-roles',
        name: 'Roles',
        href: '/administrator/roles',
        icon: Shield,
        hideFromSidebar: true,
        actions: fillCoreActions('roles', {
          view: 'roles:read',
          edit: 'roles:update',
        }),
      },
      {
        /** Dedicated matrix page — reach via Security hub; omit duplicate sidebar link. */
        id: 'admin-permissions',
        name: 'Permissions',
        href: '/administrator/security?tab=permissions',
        icon: KeyRound,
        hideFromSidebar: true,
        actions: fillCoreActions('permissions', {
          view: 'permissions:read',
        }),
      },
      {
        id: 'admin-day-lock',
        name: 'Day Lock',
        href: '/administrator/day-lock',
        icon: Lock,
        actions: fillCoreActions('admin', {
          // Historical: lock uses :day-lock and view uses :view under the
          // generic `admin` prefix.
          view: 'admin:view',
          lock: 'admin:day-lock',
        }),
      },
      {
        id: 'admin-approvals',
        name: 'Approvals',
        href: '/administrator/approvals',
        icon: CheckSquare,
        actions: fillActions('approval'),
      },
      {
        id: 'admin-pos-sales',
        name: 'POS Sales',
        href: '/administrator/pos-sales',
        icon: ShoppingCart,
        actions: fillCoreActions('pos:sale'),
      },
      {
        id: 'admin-pos-sale-records',
        name: 'POS Sale Records',
        hideFromSidebar: true,
        icon: FileBarChart,
        actions: fillCoreActions('pos:sale-records'),
      },
      {
        id: 'admin-showroom-employee',
        name: 'Showroom Employee',
        href: '/administrator/showroom-employee',
        icon: UserCog,
        actions: fillCoreActions('employee'),
      },
      {
        id: 'admin-price-manager',
        name: 'Price Manager',
        href: '/administrator/price-manager',
        icon: TrendingUp,
        actions: fillCoreActions('pricing'),
      },
      {
        id: 'admin-workflow-config',
        name: 'WorkFlow Config',
        href: '/administrator/workflow-config',
        icon: Workflow,
        actions: fillCoreActions('workflow-config'),
      },
      {
        id: 'admin-grid-config',
        name: 'Grid Configuration',
        href: '/administrator/grid-configuration',
        icon: Grid,
        hideFromSidebar: true,
        actions: fillCoreActions('grid-config'),
      },
      {
        id: 'admin-day-types',
        name: 'Day-Types',
        href: '/administrator/day-types',
        icon: CalendarDays,
        actions: fillCoreActions('day_type'),
      },
      {
        id: 'admin-delivery-turns',
        name: 'Delivery Turns',
        href: '/administrator/delivery-turns',
        icon: CalendarDays,
        actions: fillCoreActions('delivery_turn'),
      },
      {
        id: 'admin-shifts',
        name: 'Shifts',
        href: '/administrator/shifts',
        icon: Clock,
        actions: fillCoreActions('production:shift', {
          edit: 'production:shift:update',
        }),
      },
      {
        id: 'admin-rounding-rules',
        name: 'Rounding Rules',
        href: '/administrator/rounding-rules',
        icon: Calculator,
        actions: fillCoreActions('rounding-rules'),
      },
      {
        id: 'admin-production-sections',
        name: 'Production Sections',
        href: '/administrator/production-sections',
        icon: Factory,
        actions: fillCoreActions('production', {
          view: 'production:view',
          create: 'production:create',
          edit: 'production:edit',
          delete: 'production:delete',
        }),
      },
      {
        id: 'admin-section-consumables',
        name: 'Section Consumables',
        href: '/administrator/section-consumables',
        icon: Archive,
        hideFromSidebar: true,
        actions: fillCoreActions('section-consumables'),
      },
      {
        id: 'admin-theme-customization',
        name: 'Theme Customization',
        href: '/administrator/theme-customization',
        icon: Palette,
        actions: fillCoreActions('theme-customization'),
      },
      {
        id: 'admin-pos-theme',
        name: 'POS Theme',
        href: '/administrator/pos-theme',
        icon: Palette,
        actions: fillCoreActions('pos-theme'),
      },
      {
        id: 'admin-pos-backstage-key',
        name: 'POS Admin Key',
        href: '/administrator/pos-backstage-key',
        icon: KeyRound,
        actions: fillCoreActions('setting'),
      },
      {
        id: 'admin-developer',
        name: 'Developer Mode',
        href: '/administrator/developer',
        icon: Terminal,
        actions: fillCoreActions('setting'),
        superAdminOnly: true,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
//                              HELPERS
// ---------------------------------------------------------------------------

/** Flatten the catalog into a list of every permission code we know about. */
export function getAllPermissionCodes(): string[] {
  const codes = new Set<string>();
  for (const section of PERMISSION_SECTIONS) {
    if (section.modulePermission) codes.add(section.modulePermission);
    for (const sub of section.subsections) {
      for (const code of Object.values(sub.actions)) {
        if (code) codes.add(code);
      }
    }
  }
  return Array.from(codes);
}

/**
 * For a given route, return the action -> permission code map
 * (used by pages to gate buttons / actions).
 */
export function getActionsForRoute(href: string): Partial<Record<ActionKey, string>> {
  for (const section of PERMISSION_SECTIONS) {
    for (const sub of section.subsections) {
      if (sub.href === href) return sub.actions;
    }
  }
  return {};
}

/**
 * Find the subsection definition by id (handy for the permissions UI).
 */
export function findSubsectionById(id: string): SubsectionDef | undefined {
  for (const section of PERMISSION_SECTIONS) {
    const sub = section.subsections.find((s) => s.id === id);
    if (sub) return sub;
  }
  return undefined;
}
