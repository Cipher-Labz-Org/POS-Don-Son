import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface PageTheme {
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
}

/**
 * Per-page color configuration entry.
 * `path` is the Next.js route (e.g. "/operation/delivery").
 * `label` is the human-readable page name shown in the admin UI.
 * `color` is the accent color replacing the default red for that page.
 */
export interface PageColorEntry {
  path: string;
  label: string;
  section: string;
  color: string;
}

/** Default brand red used when no custom color has been set for a page. */
export const DEFAULT_BRAND_COLOR = '#C8102E';

/** Canonical page list with their default colors (all default to brand red). */
export const DEFAULT_PAGE_COLORS: PageColorEntry[] = [
  // Dashboard
  { path: '/dashboard', label: 'Dashboard', section: 'Dashboard', color: DEFAULT_BRAND_COLOR },

  // Inventory
  { path: '/inventory/products', label: 'Products', section: 'Inventory', color: DEFAULT_BRAND_COLOR },
  { path: '/inventory/category', label: 'Category', section: 'Inventory', color: DEFAULT_BRAND_COLOR },
  { path: '/inventory/uom', label: 'Unit of Measure', section: 'Inventory', color: DEFAULT_BRAND_COLOR },
  { path: '/inventory/ingredient', label: 'Ingredient', section: 'Inventory', color: DEFAULT_BRAND_COLOR },

  // Showroom
  { path: '/showroom', label: 'Showrooms', section: 'Showrooms', color: DEFAULT_BRAND_COLOR },

  // Operation
  { path: '/operation/delivery', label: 'Delivery', section: 'Operation', color: DEFAULT_BRAND_COLOR },
  { path: '/operation/approvals', label: 'All Approvals', section: 'Operation', color: DEFAULT_BRAND_COLOR },
  { path: '/operation/disposal', label: 'Disposal', section: 'Operation', color: DEFAULT_BRAND_COLOR },
  { path: '/operation/transfer', label: 'Transfer', section: 'Operation', color: DEFAULT_BRAND_COLOR },
  { path: '/operation/stock-bf', label: 'Stock BF', section: 'Operation', color: DEFAULT_BRAND_COLOR },
  { path: '/operation/cancellation', label: 'Cancellation', section: 'Operation', color: DEFAULT_BRAND_COLOR },
  { path: '/operation/delivery-return', label: 'Delivery Return', section: 'Operation', color: DEFAULT_BRAND_COLOR },
  { path: '/operation/label-printing', label: 'Label Printing', section: 'Operation', color: DEFAULT_BRAND_COLOR },
  { path: '/operation/showroom-label-printing', label: 'Showroom Label Printing', section: 'Operation', color: DEFAULT_BRAND_COLOR },

  // Production
  { path: '/production/daily-production', label: 'Daily Production', section: 'Production', color: DEFAULT_BRAND_COLOR },
  { path: '/production/approvals', label: 'All Approvals (Production)', section: 'Production', color: DEFAULT_BRAND_COLOR },
  { path: '/production/production-cancel', label: 'Production Cancel', section: 'Production', color: DEFAULT_BRAND_COLOR },
  { path: '/production/current-stock', label: 'Current Stock', section: 'Production', color: DEFAULT_BRAND_COLOR },
  { path: '/production/stock-adjustment', label: 'Stock Adjustment', section: 'Production', color: DEFAULT_BRAND_COLOR },
  { path: '/production/stock-adjustment-approval', label: 'Stock Adjustment Approval', section: 'Production', color: DEFAULT_BRAND_COLOR },
  { path: '/production/production-plan', label: 'Production Plan', section: 'Production', color: DEFAULT_BRAND_COLOR },

  // Reports
  { path: '/reports/delivery-summary', label: 'Delivery Summary', section: 'Reports', color: DEFAULT_BRAND_COLOR },
  { path: '/reports/immediate-orders', label: 'Immediate Orders', section: 'Reports', color: DEFAULT_BRAND_COLOR },
  { path: '/reports/production-summary', label: 'Production Summary', section: 'Reports', color: DEFAULT_BRAND_COLOR },
  { path: '/reports/sales-report', label: 'Sales Report', section: 'Reports', color: DEFAULT_BRAND_COLOR },
  { path: '/reports/cashier-settlement', label: 'Cashier Settlement', section: 'Reports', color: DEFAULT_BRAND_COLOR },

  // Administrator
  { path: '/administrator/users', label: 'Users', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
  { path: '/administrator/roles', label: 'Roles', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
  { path: '/administrator/permissions', label: 'Permissions', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
  { path: '/administrator/security', label: 'Security', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
  { path: '/administrator/system-settings', label: 'System Settings', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
  { path: '/administrator/day-types', label: 'Day Types', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
  { path: '/administrator/day-end-process', label: 'Day End Process', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
  { path: '/administrator/day-lock', label: 'Day Lock', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
  { path: '/administrator/shifts', label: 'Shifts', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
  { path: '/administrator/delivery-turns', label: 'Delivery Turns', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
  { path: '/administrator/delivery-plan', label: 'Delivery Plan', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
  { path: '/administrator/showroom-employee', label: 'Showroom Employee', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
  { path: '/administrator/price-manager', label: 'Price Manager', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
  { path: '/administrator/rounding-rules', label: 'Rounding Rules', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
  { path: '/administrator/grid-configuration', label: 'Grid Configuration', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
  { path: '/administrator/workflow-config', label: 'Workflow Config', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
  { path: '/administrator/approvals', label: 'Approvals', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
  { path: '/administrator/pos-sales', label: 'POS Sales', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
  { path: '/administrator/cashier-balance', label: 'Cashier Balance', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
  { path: '/administrator/label-settings', label: 'Label Settings', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
  { path: '/administrator/label-key-settings', label: 'Label Key Settings', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
  { path: '/administrator/label-templates', label: 'Label Templates', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
  { path: '/administrator/section-consumables', label: 'Section Consumables', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
  { path: '/administrator/theme-customization', label: 'Theme Customization', section: 'Administrator', color: DEFAULT_BRAND_COLOR },
];

/** Build an initial path→color lookup map from the default list. */
function buildDefaultColorMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of DEFAULT_PAGE_COLORS) {
    map[entry.path] = entry.color;
  }
  return map;
}

export interface ThemeStore {
  // Dark/Light mode
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;

  // Per-page color map: route path → hex color
  pageColorMap: Record<string, string>;
  setPageColor: (path: string, color: string) => void;
  getPageColor: (path: string) => string;
  resetPageColor: (path: string) => void;
  resetAllPageColors: () => void;

  // Legacy page themes kept for backward compat (existing pages may read them)
  pageThemes: Record<string, PageTheme>;
  setPageTheme: (pageKey: string, theme: PageTheme) => void;
  getPageTheme: (pageKey: string) => PageTheme;
  resetPageTheme: (pageKey: string) => void;
  resetAllThemes: () => void;

  // Hydration tracking
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

const DEFAULT_THEMES: Record<string, PageTheme> = {
  delivery: { primaryColor: '#3B82F6', secondaryColor: '#C8102E' },
  disposal: { primaryColor: '#DC2626', secondaryColor: '#B91C1C' },
  transfer: { primaryColor: '#F59E0B', secondaryColor: '#D97706' },
  'stock-bf': { primaryColor: '#8B5CF6', secondaryColor: '#7C3AED' },
  cancellation: { primaryColor: '#EF4444', secondaryColor: '#DC2626' },
  'delivery-return': { primaryColor: '#F97316', secondaryColor: '#EA580C' },
  'label-printing': { primaryColor: '#10B981', secondaryColor: '#059669' },
  'daily-production': { primaryColor: '#0EA5E9', secondaryColor: '#0284C7' },
  'production-cancel': { primaryColor: '#EC4899', secondaryColor: '#DB2777' },
};

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      mode: 'light',
      _hasHydrated: false,

      setMode: (mode) => set({ mode }),

      toggleMode: () => {
        const newMode = get().mode === 'light' ? 'dark' : 'light';
        set({ mode: newMode });
      },

      // Per-page color map
      pageColorMap: buildDefaultColorMap(),

      setPageColor: (path, color) =>
        set((state) => ({
          pageColorMap: { ...state.pageColorMap, [path]: color },
        })),

      getPageColor: (path) => {
        const map = get().pageColorMap;
        // Exact match first
        if (map[path]) return map[path];
        // Prefix match for sub-routes (e.g. /operation/delivery/123 → /operation/delivery)
        const matched = Object.keys(map)
          .filter((k) => path.startsWith(k) && k !== '/')
          .sort((a, b) => b.length - a.length)[0];
        return matched ? map[matched] : DEFAULT_BRAND_COLOR;
      },

      resetPageColor: (path) =>
        set((state) => ({
          pageColorMap: {
            ...state.pageColorMap,
            [path]: DEFAULT_BRAND_COLOR,
          },
        })),

      resetAllPageColors: () => set({ pageColorMap: buildDefaultColorMap() }),

      // Legacy
      pageThemes: { ...DEFAULT_THEMES },

      setPageTheme: (pageKey, theme) =>
        set((state) => ({
          pageThemes: { ...state.pageThemes, [pageKey]: theme },
        })),

      getPageTheme: (pageKey) => {
        const theme = get().pageThemes[pageKey];
        return theme ?? DEFAULT_THEMES[pageKey] ?? DEFAULT_THEMES.delivery;
      },

      resetPageTheme: (pageKey) =>
        set((state) => ({
          pageThemes: {
            ...state.pageThemes,
            [pageKey]: DEFAULT_THEMES[pageKey] || DEFAULT_THEMES.delivery,
          },
        })),

      resetAllThemes: () => set({ pageThemes: { ...DEFAULT_THEMES } }),

      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'dms-theme-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
