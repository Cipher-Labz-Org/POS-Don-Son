'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardTitle, CardContent } from '@/components/ui/card';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import { ArrowLeft, Plus, Loader2, Search } from 'lucide-react';
import { labelPrintingApi } from '@/lib/api/label-printing';
import {
  labelPrintingCommentsApi,
  type LabelPrintingComment,
} from '@/lib/api/label-printing-comments';
import { productsApi, type Product } from '@/lib/api/products';
import { useAuthStore } from '@/lib/stores/auth-store';
import { DEFAULT_BRAND_COLOR, useThemeStore } from '@/lib/stores/theme-store';
import { getDateBounds, todayISO } from '@/lib/date-restrictions';
import toast from 'react-hot-toast';
import { ProtectedPage } from '@/components/auth';
import { formatSlDate } from '@/lib/sri-lanka-time';
import { filterByCodeOrName } from '@/lib/product-search';

function addCalendarDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return formatSlDate(d, { dateStyle: 'medium' });
}

function readOnlyPanel(children: React.ReactNode) {
  return (
    <div
      className="rounded-md border border-dashed px-2.5 py-1.5 text-xs leading-snug"
      style={{
        backgroundColor: 'var(--muted)',
        borderColor: 'var(--border)',
        color: 'var(--muted-foreground)',
      }}
    >
      {children}
    </div>
  );
}

function ProductSearchField({
  products,
  value,
  onChange,
  accent,
}: {
  products: Product[];
  value: string;
  onChange: (id: string) => void;
  accent: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = products.find((p) => p.id === value);
  const displayValue = selected
    ? `${selected.code} — ${selected.name}${selected.allowFutureLabelPrint ? ' ☀️' : ''}`
    : '';

  const filtered = useMemo(() => filterByCodeOrName(products, query), [products, query]);

  useEffect(() => {
    setHighlighted(0);
  }, [query, open, filtered.length]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const pick = useCallback(
    (id: string) => {
      onChange(id);
      setQuery('');
      setOpen(false);
    },
    [onChange],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    if (!v.trim()) onChange('');
  };

  const handleFocus = () => {
    setOpen(true);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const p = filtered[highlighted];
      if (p) pick(p.id);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: 'var(--muted-foreground)' }}
        />
        <input
          type="text"
          className="w-full rounded-lg border-2 py-2 pl-9 pr-3 text-sm transition-[border-color,outline] focus:outline-none"
          style={{
            backgroundColor: 'var(--background)',
            borderColor: open ? accent : 'var(--form-field-border)',
            color: 'var(--foreground)',
            boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.04)',
          }}
          placeholder={products.length === 0 ? 'No products available' : 'Enter Product Code'}
          value={open ? query : displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={onKeyDown}
          autoComplete="off"
          disabled={products.length === 0}
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="label-print-product-suggestions"
        />
      </div>
      <p className="mt-0.5 text-[11px] leading-tight" style={{ color: 'var(--muted-foreground)' }}>
        Use ↑/↓ and Enter to select an item.
      </p>
      {products.length === 0 && (
        <p className="mt-1 text-xs text-amber-600">
          No products with label printing enabled. Enable &quot;Label Print&quot; on products in Inventory settings.
        </p>
      )}
      {open && products.length > 0 && (
        <div
          id="label-print-product-suggestions"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border shadow-lg"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          role="listbox"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              No products match your search.
            </div>
          ) : (
            filtered.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={p.id === value}
                className="w-full px-2.5 py-1.5 text-left text-sm transition-colors"
                style={{
                  backgroundColor:
                    idx === highlighted ? 'var(--muted)' : p.id === value ? `${accent}22` : 'transparent',
                  color: 'var(--foreground)',
                }}
                onMouseEnter={() => setHighlighted(idx)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(p.id)}
              >
                <span className="font-mono text-xs opacity-80">{p.code}</span>
                <span className="mx-2 opacity-40">·</span>
                <span>{p.name}</span>
                {p.allowFutureLabelPrint ? <span className="ml-1">☀️</span> : null}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function AddLabelPrintingPage() {
  return (
    <ProtectedPage permission="operation:label-printing:view">
      <AddLabelPrintingPageContent />
    </ProtectedPage>
  );
}

function AddLabelPrintingPageContent() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const pageTheme = useThemeStore((s) => s.getPageTheme('label-printing'));
  const accent = pageTheme?.secondaryColor ?? pageTheme?.primaryColor ?? DEFAULT_BRAND_COLOR;

  const dateBounds = getDateBounds('today-only', user as any, {
    allowBackDatePermission: 'operation:label-printing:allow-back-date',
    allowFutureDatePermission: 'operation:label-printing:allow-future-date',
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [masterComments, setMasterComments] = useState<LabelPrintingComment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentPickerOpen, setCommentPickerOpen] = useState(false);
  const [pickerDraft, setPickerDraft] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    productId: '',
    manufactureDate: todayISO(),
    batchNo: '',
    labelCount: '1',
  });

  const [selectedCommentIds, setSelectedCommentIds] = useState<string[]>([]);

  useEffect(() => {
    void fetchComments();
  }, []);

  useEffect(() => {
    void fetchProducts();
  }, [formData.manufactureDate]);

  const fetchProducts = async () => {
    try {
      const response = await productsApi.getAll(1, 1000, undefined, undefined, undefined, formData.manufactureDate);
      const labelPrintProducts = (response.products || []).filter(
        (p: Product) => p.isActive && p.enableLabelPrint,
      );
      setProducts(labelPrintProducts);
      if (labelPrintProducts.length === 0) {
        toast(
          'No products available for label printing. Enable "Label Print" for products in inventory settings.',
          { duration: 5000, icon: 'ℹ️' },
        );
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to load products');
    }
  };

  const fetchComments = async () => {
    try {
      const list = await labelPrintingCommentsApi.getAll(true);
      setMasterComments(list);
    } catch {
      setMasterComments([]);
    }
  };

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === formData.productId),
    [products, formData.productId],
  );

  const catalogUnitPrice = useMemo(() => {
    if (!selectedProduct) return null;
    const n = Number(selectedProduct.unitPrice);
    return Number.isFinite(n) ? n : null;
  }, [selectedProduct]);

  const hasAllowFutureLabelPrint = selectedProduct?.allowFutureLabelPrint || false;

  const expiryDaysFromProduct = useMemo(() => {
    const d = selectedProduct?.expiryDays;
    if (d != null && Number(d) > 0) return Math.round(Number(d));
    return 7;
  }, [selectedProduct]);

  const calculatedExpiryText = useMemo(() => {
    if (!formData.manufactureDate || !selectedProduct) {
      return 'Select a product and manufacture date to calculate expiry.';
    }
    const end = addCalendarDays(formData.manufactureDate, expiryDaysFromProduct);
    return `Auto from item expiry setup: ${expiryDaysFromProduct} day(s) from manufacture → ${end}.`;
  }, [formData.manufactureDate, selectedProduct, expiryDaysFromProduct]);

  const selectedCommentLines = useMemo(() => {
    return selectedCommentIds
      .map((id) => masterComments.find((c) => c.id === id)?.commentText)
      .filter(Boolean) as string[];
  }, [selectedCommentIds, masterComments]);

  const openCommentPicker = () => {
    setPickerDraft([...selectedCommentIds]);
    setCommentPickerOpen(true);
  };

  const applyCommentPicker = () => {
    setSelectedCommentIds([...new Set(pickerDraft)]);
    setCommentPickerOpen(false);
  };

  const togglePickerComment = (id: string) => {
    setPickerDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productId) {
      toast.error('Select a product using the search field.');
      return;
    }
    if (catalogUnitPrice == null) {
      toast.error('Product price is required. Choose a product with a valid catalog price.');
      return;
    }

    try {
      setIsSubmitting(true);
      await labelPrintingApi.create({
        date: formData.manufactureDate,
        productId: formData.productId,
        labelCount: Number(formData.labelCount) || 1,
        startDate: formData.manufactureDate,
        expiryDays: expiryDaysFromProduct,
        priceOverride: catalogUnitPrice,
      });
      toast.success('Label print request created successfully');
      router.push('/operation/label-printing');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to create label print request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 p-3 sm:p-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
          Label Print Entry
        </h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Create a new label print job.
        </p>
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-col gap-1 border-b px-3 py-2 sm:flex-row sm:items-start sm:justify-between sm:px-4">
          <div>
            
          </div>
          <Button variant="ghost" size="sm" className="shrink-0 self-start" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        <div
          className="border-b px-3 py-2 sm:px-4"
          style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
        >
          <CardTitle className="text-base">Label Details</CardTitle>
        </div>

        <CardContent className="p-3 sm:p-4">
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-x-3 md:gap-y-2">
              <div className="md:col-span-2">
                <label className="mb-0.5 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  Product <span className="text-red-500">*</span>
                </label>
                <ProductSearchField
                  products={products}
                  value={formData.productId}
                  onChange={(productId) => setFormData((prev) => ({ ...prev, productId }))}
                  accent={accent}
                />
              </div>

              <Input
                compact
                label="Manufacture Date"
                type="date"
                value={formData.manufactureDate}
                onChange={(e) => setFormData({ ...formData, manufactureDate: e.target.value })}
                min={dateBounds.min}
                max={dateBounds.max}
                helperText={
                  hasAllowFutureLabelPrint ? 'Future dates allowed for this product' : dateBounds.helperText
                }
                variant={hasAllowFutureLabelPrint ? 'yellow' : 'default'}
                fullWidth
                required
              />
              <Input
                compact
                label="Batch No."
                value={formData.batchNo}
                onChange={(e) => setFormData({ ...formData, batchNo: e.target.value })}
                placeholder="Optional"
                fullWidth
              />

              <Input
                compact
                label="Price"
                type="number"
                min="0"
                step="0.01"
                value={catalogUnitPrice != null ? String(catalogUnitPrice) : ''}
                placeholder="Select a product"
                fullWidth
                required
                disabled
                helperText="From product catalog (effective price for manufacture date)"
              />
              <Input
                compact
                label="Qty"
                type="number"
                min="1"
                value={formData.labelCount}
                onChange={(e) => setFormData({ ...formData, labelCount: e.target.value })}
                fullWidth
                required
              />

              <div className="space-y-1 md:col-span-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium sm:text-sm" style={{ color: 'var(--foreground)' }}>
                    Comments
                  </span>
                  <Button type="button" size="sm" variant="secondary" onClick={openCommentPicker}>
                    Add Comment(s)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedCommentIds([])}
                    disabled={selectedCommentIds.length === 0}
                  >
                    Clear
                  </Button>
                </div>
                {readOnlyPanel(
                  selectedCommentLines.length > 0 ? (
                    <ul className="list-inside list-disc space-y-0.5">
                      {selectedCommentLines.map((t, i) => (
                        <li key={`${t}-${i}`}>{t}</li>
                      ))}
                    </ul>
                  ) : (
                    'No comments selected.'
                  ),
                )}
              </div>

              <div className="md:col-span-2">
                <label className="mb-0.5 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  Ingredients
                </label>
                {readOnlyPanel(
                  <>
                    <p>Auto from selected item setup.</p>
                    {selectedProduct?.description?.trim() ? (
                      <p className="mt-1.5 border-t border-dashed pt-1.5" style={{ borderColor: 'var(--border)' }}>
                        {selectedProduct.description.trim()}
                      </p>
                    ) : null}
                  </>,
                )}
              </div>

              <div className="md:col-span-2">
                <label className="mb-0.5 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  Calculated Expiry
                </label>
                {readOnlyPanel(calculatedExpiryText)}
              </div>

            </div>

            <div className="flex justify-end gap-2 border-t pt-2.5" style={{ borderColor: 'var(--border)' }}>
              <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isSubmitting || !formData.productId}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Request
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {commentPickerOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setCommentPickerOpen(false)}
        >
          <div
            className="max-h-[min(70vh,32rem)] w-full max-w-md overflow-hidden rounded-lg shadow-xl"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="label-comment-picker-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
              <h4 id="label-comment-picker-title" className="font-semibold" style={{ color: 'var(--foreground)' }}>
                Select comments
              </h4>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Choose one or more predefined label comments (from Label settings).
              </p>
            </div>
            <div className="max-h-[min(50vh,22rem)] overflow-y-auto px-4 py-3">
              {masterComments.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  No predefined comments. Add them under Administrator → Label settings.
                </p>
              ) : (
                <ul className="space-y-2">
                  {masterComments.map((c) => (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={pickerDraft.includes(c.id)}
                          onChange={() => togglePickerComment(c.id)}
                        />
                        <span style={{ color: 'var(--foreground)' }}>{c.commentText}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCommentPickerOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={applyCommentPicker}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
