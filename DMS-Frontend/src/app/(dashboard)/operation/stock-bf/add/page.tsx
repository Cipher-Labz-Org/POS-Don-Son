'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import { Loader2, Send } from 'lucide-react';
import ClassicEntryForm from '@/components/operation/ClassicEntryForm';
import { stockBfApi } from '@/lib/api/stock-bf';
import { outletsApi, type Outlet } from '@/lib/api/outlets';
import { productsApi, type Product } from '@/lib/api/products';
import DeliveryLineItemsEntry from '@/components/operation/DeliveryLineItemsEntry';
import type { ItemManagementItem } from '@/components/operation/ItemManagementTable';
import { useAuthStore } from '@/lib/stores/auth-store';
import { DEFAULT_BRAND_COLOR, useThemeStore } from '@/lib/stores/theme-store';
import { getDateBounds, yesterdayISO } from '@/lib/date-restrictions';
import { usePermissions } from '@/hooks/usePermissions';
import toast from 'react-hot-toast';
import ProtectedPage from '@/components/auth/ProtectedPage';

export default function AddStockBFPage() {
  return (
    <ProtectedPage permission="operation:stock-bf:view">
      <AddStockBFPageContent />
    </ProtectedPage>
  );
}

function AddStockBFPageContent() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const _hasHydrated = useAuthStore((s) => s._hasHydrated);
  const { canAction } = usePermissions();
  const canCreate = canAction('/operation/stock-bf', 'create');
  const pageTheme = useThemeStore((s) => s.getPageTheme('stock-bf'));
  const accent = pageTheme?.primaryColor ?? DEFAULT_BRAND_COLOR;
  const dateBounds = getDateBounds('back-3-no-future', user as any, {
    allowBackDatePermission: 'operation:stock-bf:allow-back-date',
    allowFutureDatePermission: 'operation:stock-bf:allow-future-date',
  });

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    bfDate: yesterdayISO(),
    showroomId: '',
  });

  const [stockBfItems, setStockBfItems] = useState<ItemManagementItem[]>([]);
  const [entryLocked, setEntryLocked] = useState(false);
  const [lockChecking, setLockChecking] = useState(false);

  const isFormValid = !!formData.bfDate && !!formData.showroomId && stockBfItems.length > 0;

  useEffect(() => {
    if (!_hasHydrated) return;
    void fetchOutlets();
  }, [_hasHydrated]);

  useEffect(() => {
    if (!_hasHydrated) return;
    void fetchProducts(formData.bfDate);
  }, [_hasHydrated, formData.bfDate]);

  useEffect(() => {
    if (!formData.bfDate || !formData.showroomId) {
      setEntryLocked(false);
      return;
    }
    let cancelled = false;
    setLockChecking(true);
    void (async () => {
      try {
        const response = await stockBfApi.getAll(1, 200, {
          startDate: formData.bfDate,
          endDate: formData.bfDate,
          outletId: formData.showroomId,
        });
        const rows = Array.isArray(response.stockBFs) ? response.stockBFs : [];
        const locked = rows.some((r: { status?: string }) => {
          const s = String(r.status ?? '').toLowerCase();
          return s !== 'rejected' && s !== 'cancelled';
        });
        if (!cancelled) {
          setEntryLocked(locked);
          if (locked) {
            const lockedItems: ItemManagementItem[] = rows
              .filter((r: { status?: string }) => {
                const s = String(r.status ?? '').toLowerCase();
                return s !== 'rejected' && s !== 'cancelled';
              })
              .map((r: { productId?: string; quantity?: number }) => ({
                productId: String(r.productId ?? ''),
                quantity: Number(r.quantity ?? 0),
              }))
              .filter((item) => item.productId);
            setStockBfItems(lockedItems);
          } else {
            setStockBfItems([]);
          }
        }
      } catch {
        if (!cancelled) setEntryLocked(false);
      } finally {
        if (!cancelled) setLockChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formData.bfDate, formData.showroomId]);

  const fetchOutlets = async () => {
    try {
      const response = await outletsApi.getAll(1, 1000);
      const list = Array.isArray(response.outlets) ? response.outlets : [];
      setOutlets(list.filter((o) => o.isActive !== false));
    } catch (error: any) {
      const msg =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        'Failed to load showrooms';
      toast.error(msg);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await productsApi.getAll(1, 5000, undefined, undefined, true, formData.bfDate);
      const list = Array.isArray(response.products) ? response.products : [];
      setProducts(
        list.filter((p) => p.isActive !== false && p.displayInPOS !== false && p.requireOpenStock === true),
      );
    } catch (error: any) {
      const msg =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        'Failed to load products';
      toast.error(msg);
    }
  };

  const handleSubmit = async () => {
    if (!canCreate) {
      toast.error('You do not have permission to create stock B/F');
      return;
    }
    if (entryLocked) {
      toast.error('Opening stock for this showroom and date is already submitted. Re-entry is allowed only after rejection.');
      return;
    }
    if (!formData.showroomId) {
      toast.error('Please select a showroom');
      return;
    }
    if (stockBfItems.length === 0) {
      toast.error('Please add at least one product');
      return;
    }

    try {
      setIsSubmitting(true);
      await stockBfApi.createBulk({
        bfDate: formData.bfDate,
        outletId: formData.showroomId,
        items: stockBfItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      });
      toast.success(`${stockBfItems.length} Stock BF record(s) created — pending approval`);
      router.push('/operation/stock-bf');
    } catch (error: any) {
      toast.error(
        error.response?.data?.error?.message ||
          error.response?.data?.message ||
          'Failed to create stock BF',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ClassicEntryForm
      title="New Stock B/F"
      documentLabel="Stock B/F No#"
      backHref="/operation/stock-bf"
      header={
        <>
          <Select
            label="ShowRoom"
            value={formData.showroomId}
            onChange={(e) => setFormData({ ...formData, showroomId: e.target.value })}
            options={outlets.map((o) => ({ value: o.id, label: `${o.code} - ${o.name}` }))}
            placeholder="Select Showroom"
            fullWidth
            required
          />
          <Input
            label="BF DateTime"
            type="date"
            value={formData.bfDate}
            onChange={(e) => setFormData({ ...formData, bfDate: e.target.value })}
            min={dateBounds.min}
            max={dateBounds.max}
            helperText={dateBounds.helperText}
            fullWidth
            required
          />
          {entryLocked ? (
            <p className="text-sm font-medium sm:col-span-2" style={{ color: 'var(--foreground)' }}>
              Opening stock for this showroom and date is already submitted. It can be entered again only if DMS rejects it.
            </p>
          ) : null}
        </>
      }
      footer={
        <Button
          type="button"
          variant="primary"
          disabled={isSubmitting || !canCreate || !isFormValid || entryLocked || lockChecking}
          onClick={() => void handleSubmit()}
        >
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Submit
        </Button>
      }
    >
      <fieldset disabled={entryLocked || lockChecking} className={entryLocked ? 'pointer-events-none' : undefined}>
        <DeliveryLineItemsEntry
          products={products}
          items={stockBfItems}
          onItemsChange={setStockBfItems}
          primaryColor={accent}
          hideSearchLabel
          searchHelperText=""
        />
      </fieldset>
    </ClassicEntryForm>
  );
}
