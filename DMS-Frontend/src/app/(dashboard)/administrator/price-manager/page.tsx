'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import Button from '@/components/ui/button';
import Select from '@/components/ui/select';
import { Modal, ModalFooter } from '@/components/ui/modal';
import { ProtectedPage } from '@/components/auth';
import { usePermissions } from '@/hooks/usePermissions';
import { DollarSign, Plus, Search, Edit2, Info, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { priceListsApi, type PriceList } from '@/lib/api/price-lists';
import { productsApi, type Product } from '@/lib/api/products';
import CsvBulkUploadBar from '@/components/dms/CsvBulkUploadBar';
import { foldProductSearch } from '@/lib/product-search';
import { formatCalendarDateInZone, formatSlDateSlashMon, formatSlDateTime } from '@/lib/sri-lanka-time';

const PAGE_SIZES = [10, 25, 50];

function fmtEffectiveFrom(iso: string): string {
  if (!iso) return '-';
  return formatSlDateSlashMon(iso);
}

/** Edit timestamp in Sri Lanka local time. */
function fmtEditDate(iso: string): string {
  if (!iso) return '-';
  return formatSlDateTime(iso, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export default function PriceManagerPage() {
  const router = useRouter();
  const { can, canAction } = usePermissions();
  const canCreate = can('pricing:create') || canAction('/administrator/price-manager', 'create');

  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<PriceList | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const bulkItemsRef = useRef<{ productId: string; unitPrice: number }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await priceListsApi.getAll(page, pageSize, search || undefined);
      setPriceLists(res.priceLists);
      setTotalCount(res.totalCount);
    } catch {
      toast.error('Failed to load price manager records.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const pageSize = 200;
        const first = await productsApi.getAll(1, pageSize, undefined, undefined, true);
        const all = [...first.products];
        for (let p = 2; p <= first.totalPages; p++) {
          const next = await productsApi.getAll(p, pageSize, undefined, undefined, true);
          all.push(...next.products);
        }
        if (!cancelled) setProducts(all);
      } catch {
        /* bulk import still works after products load on add page */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSearchChange = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <ProtectedPage permission="pricing:view">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: 'var(--foreground)' }}>
              <DollarSign className="w-8 h-8" style={{ color: '#C8102E' }} />
              Price Manager
              <span className="text-base font-normal" style={{ color: 'var(--muted-foreground)' }}>
                List pricing
              </span>
            </h1>
          </div>
          {canCreate && (
            <Button
              variant="primary"
              size="md"
              onClick={() => router.push('/administrator/price-manager/add')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New
            </Button>
          )}
        </div>

        {canCreate && (
          <CsvBulkUploadBar<{ productId: string; unitPrice: number }>
            entityLabel="price changes"
            templateFilename="price-manager-items.csv"
            permission="pricing:create"
            columns={[{ header: 'productCode' }, { header: 'newPrice' }]}
            previewDataHeaders={['productCode', 'newPrice']}
            exampleRows={[['P001', '250.00']]}
            mapRow={async (row) => {
              const code = (row.productCode ?? '').trim();
              const priceRaw = (row.newPrice ?? '').trim();
              if (!code) return { ok: false, error: 'productCode is required' };
              const product = products.find((p) => foldProductSearch(p.code) === foldProductSearch(code));
              if (!product) return { ok: false, error: `Unknown product code: ${code}` };
              const unitPrice = Number(priceRaw);
              if (!Number.isFinite(unitPrice) || unitPrice < 0) return { ok: false, error: 'Invalid newPrice' };
              return { ok: true, value: { productId: product.id, unitPrice } };
            }}
            importRow={async (value) => {
              bulkItemsRef.current.push(value);
            }}
            onImportComplete={() => {
              const items = bulkItemsRef.current;
              bulkItemsRef.current = [];
              if (items.length === 0) return;
              const unique = Array.from(new Map(items.map((i) => [i.productId, i])).values());
              const today = formatCalendarDateInZone(new Date());
              const ts = Date.now().toString(36).toUpperCase();
              void priceListsApi
                .create({
                  code: `PM-${today.replace(/-/g, '')}-${ts}`.slice(0, 50),
                  name: 'Bulk import',
                  description: 'Bulk import',
                  priceListType: 'Pending',
                  currency: 'LKR',
                  effectiveFrom: today,
                  isDefault: false,
                  priority: 0,
                  isActive: true,
                  items: unique,
                })
                .then(() => {
                  toast.success('Bulk price change submitted for approval.');
                  void load();
                })
                .catch((err: any) => {
                  toast.error(err?.response?.data?.message ?? 'Failed to submit bulk price change.');
                });
            }}
          />
        )}

        <Card>
          {/* Table controls header */}
          <div
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            {/* Records per page */}
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              <Select
                value={String(pageSize)}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                options={PAGE_SIZES.map((s) => ({ value: String(s), label: String(s) }))}
              />
              <span>records per page</span>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Search:</span>
              <div className="relative">
                <Search
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: 'var(--muted-foreground)' }}
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-sm rounded-md"
                  style={{
                    border: '1px solid var(--input)',
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)',
                    width: 200,
                  }}
                />
              </div>
            </div>
          </div>

          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#C8102E' }} />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                        {[
                          { label: 'Effective Date', sortable: true },
                          { label: 'Status', sortable: true },
                          { label: 'Items', sortable: true },
                          { label: 'Comment', sortable: true },
                          { label: 'User', sortable: true },
                          { label: 'Edit Date', sortable: true },
                          { label: '' },
                        ].map((h) => (
                          <th
                            key={h.label}
                            className="px-4 py-3 text-left font-semibold whitespace-nowrap"
                            style={{ color: 'var(--foreground)' }}
                          >
                            {h.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {priceLists.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-12 text-center text-sm"
                            style={{ color: 'var(--muted-foreground)' }}
                          >
                            No price records found.
                          </td>
                        </tr>
                      ) : (
                        priceLists.map((pl) => (
                          <tr
                            key={pl.id}
                            className="border-t transition-colors"
                            style={{ borderColor: 'var(--border)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--muted)')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            {/* Effective Date */}
                            <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--foreground)' }}>
                              {fmtEffectiveFrom(pl.effectiveFrom)}
                            </td>

                            <td className="px-4 py-3 whitespace-nowrap">
                              <StatusBadge status={pl.priceListType} />
                            </td>

                            <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--foreground)' }}>
                              {pl.itemCount ?? 0}
                            </td>

                            {/* Comment = name or description */}
                            <td className="px-4 py-3" style={{ color: 'var(--foreground)' }}>
                              {pl.description || pl.name}
                            </td>

                            {/* User = createdByName */}
                            <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--foreground)' }}>
                              {pl.createdByName || '-'}
                            </td>

                            {/* Edit Date = updatedAt */}
                            <td
                              className="px-4 py-3 whitespace-nowrap text-xs"
                              style={{ color: 'var(--muted-foreground)' }}
                            >
                              {fmtEditDate(pl.updatedAt || pl.createdAt)}
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button
                                  title="Details"
                                  onClick={async () => {
                                    setDetailOpen(true);
                                    setDetailLoading(true);
                                    try {
                                      const full = await priceListsApi.getById(pl.id);
                                      setSelected(full);
                                    } catch {
                                      setSelected(pl);
                                      toast.error('Could not load item lines.');
                                    } finally {
                                      setDetailLoading(false);
                                    }
                                  }}
                                  className="p-1.5 rounded transition-colors"
                                  style={{ color: 'var(--muted-foreground)' }}
                                  onMouseEnter={(e) => (e.currentTarget.style.color = '#C8102E')}
                                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted-foreground)')}
                                >
                                  <Info className="w-4 h-4" />
                                </button>
                                {can('pricing:edit') && isPendingStatus(pl.priceListType) && (
                                  <button
                                    title="Edit"
                                    onClick={() => router.push(`/administrator/price-manager/edit/${pl.id}`)}
                                    className="p-1.5 rounded transition-colors"
                                    style={{ color: 'var(--muted-foreground)' }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = '#2563EB')}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted-foreground)')}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer: showing + pagination */}
                <div
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    {totalCount === 0
                      ? 'No entries'
                      : `Showing ${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, totalCount)} of ${totalCount} entries`}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      Previous
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                      .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === '...' ? (
                          <span
                            key={`e-${i}`}
                            className="px-2 text-sm"
                            style={{ color: 'var(--muted-foreground)' }}
                          >
                            …
                          </span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setPage(p as number)}
                            className="w-8 h-8 rounded text-sm font-medium transition-colors"
                            style={{
                              backgroundColor: page === p ? '#C8102E' : 'transparent',
                              color: page === p ? 'white' : 'var(--foreground)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            {p}
                          </button>
                        )
                      )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Detail modal */}
        {selected && (
          <Modal
            isOpen={detailOpen}
            onClose={() => setDetailOpen(false)}
            title="Price Record Details"
            size="lg"
          >
            <div className="space-y-3 text-sm">
              {detailLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-8 animate-spin" style={{ color: '#C8102E' }} />
                </div>
              ) : (
                <>
              <DetailRow label="Effective Date" value={fmtEffectiveFrom(selected.effectiveFrom)} />
              <DetailRow label="Status" value={statusLabel(selected.priceListType)} />
              <DetailRow label="Comment" value={selected.description || selected.name} />
              <DetailRow label="User" value={selected.createdByName || '-'} />
              <DetailRow label="Edit Date" value={fmtEditDate(selected.updatedAt || selected.createdAt)} />
              <DetailRow label="Code" value={selected.code} />
              {(selected.items ?? []).length > 0 && (
                <div className="pt-2">
                  <p className="mb-2 font-medium" style={{ color: 'var(--muted-foreground)' }}>
                    Items
                  </p>
                  <div className="overflow-x-auto rounded-md border" style={{ borderColor: 'var(--border)' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: 'var(--muted)' }}>
                          <th className="px-2 py-1.5 text-left">Code</th>
                          <th className="px-2 py-1.5 text-left">Item</th>
                          <th className="px-2 py-1.5 text-right">Previous</th>
                          <th className="px-2 py-1.5 text-right">New</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.items!.map((item) => (
                          <tr key={item.productId} className="border-t" style={{ borderColor: 'var(--border)' }}>
                            <td className="px-2 py-1.5 font-mono">{item.productCode}</td>
                            <td className="px-2 py-1.5">{item.productName}</td>
                            <td className="px-2 py-1.5 text-right">{formatRs(item.previousPrice)}</td>
                            <td className="px-2 py-1.5 text-right font-semibold">{formatRs(item.newPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
                </>
              )}
            </div>
            <ModalFooter>
              <Button variant="ghost" onClick={() => setDetailOpen(false)}>
                Close
              </Button>
              {can('pricing:edit') && isPendingStatus(selected.priceListType) && (
                <Button
                  variant="primary"
                  onClick={() => {
                    setDetailOpen(false);
                    router.push(`/administrator/price-manager/edit/${selected.id}`);
                  }}
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
            </ModalFooter>
          </Modal>
        )}
      </div>
    </ProtectedPage>
  );
}

function formatRs(n: number) {
  return `Rs. ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isPendingStatus(type?: string) {
  const t = (type || '').toLowerCase();
  return t === 'pending' || t === 'standard' || t === '';
}

function statusLabel(type?: string) {
  const t = (type || '').toLowerCase();
  if (t === 'approved') return 'Approved';
  if (t === 'rejected') return 'Rejected';
  return 'Pending';
}

function StatusBadge({ status }: { status?: string }) {
  const label = statusLabel(status);
  const color =
    label === 'Approved' ? '#166534' : label === 'Rejected' ? '#991B1B' : '#92400E';
  const bg =
    label === 'Approved' ? '#DCFCE7' : label === 'Rejected' ? '#FEE2E2' : '#FEF3C7';
  return (
    <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ color, backgroundColor: bg }}>
      {label}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-36 shrink-0 font-medium" style={{ color: 'var(--muted-foreground)' }}>
        {label}
      </span>
      <span style={{ color: 'var(--foreground)' }}>{value}</span>
    </div>
  );
}
