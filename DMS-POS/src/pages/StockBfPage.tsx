import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Printer, X } from 'lucide-react'
import { PosSubPageLayout } from '../components/PosSubPageLayout'
import { CatalogStaleBanner } from '../components/CatalogStaleBanner'
import { useAuthStore } from '../lib/auth-store'
import { useSettingsStore } from '../lib/settings-store'
import { loadProductsIntoDb } from '../lib/catalog-sync'
import { offlineDb } from '../lib/offline-db'
import type { ProductRow } from '../lib/types'
import { fetchStockBfRecords, postStockBfBulk } from '../lib/api'
import { enqueueMutation } from '../lib/sync-queue'
import { useOnlineStatus } from '../lib/use-online-status'
import { extractBfNoFromBulkResponse, printStockBfHtml } from '../lib/print-stock-bf'
import { formatStockBfQty, normalizeStockBfQtyInput, parseStockBfQty } from '../lib/stock-bf-qty'
import { toast } from '../lib/toast-store'
import { formatSubmitError, isConflictStatus, isUnreachableNetworkError, isAlreadyRecordedError } from '../lib/api-errors'
import { todayCalendarISO } from '../lib/calendar-date'
import { useSriLankaBusinessDay } from '../lib/use-sri-lanka-business-day'
import { SearchKeyboard } from '../components/SearchKeyboard'
import { ItemSearchField, filterItemChoices, formatSelectedItemSearchLabel } from '../components/ItemSearchField'
import { QtyStepper } from '../components/QtyStepper'

type Props = { onBack: () => void }
type BfRow = { productId: string; code: string; name: string; qty: number }

function isBlockingStockBfStatus(status: string) {
  const s = status.toLowerCase()
  return s !== 'rejected' && s !== 'cancelled'
}

function mapServerRows(
  raw: Record<string, unknown>[],
  products: ProductRow[],
): BfRow[] {
  const byProduct = new Map<string, BfRow>()
  for (const r of raw) {
    const status = String(r.status ?? r.Status ?? '')
    if (!isBlockingStockBfStatus(status)) continue
    const productId = String(r.productId ?? r.ProductId ?? '')
    if (!productId) continue
    const catalog = products.find((p) => p.id === productId)
    const code = String(r.productCode ?? r.ProductCode ?? catalog?.code ?? '')
    const name = String(r.productName ?? r.ProductName ?? catalog?.name ?? '—')
    const qty = Number(r.quantity ?? r.Quantity ?? 0)
    const existing = byProduct.get(productId)
    if (existing) {
      existing.qty += qty
    } else {
      byProduct.set(productId, { productId, code, name, qty })
    }
  }
  return [...byProduct.values()]
}

export function StockBfPage({ onBack }: Props) {
  const user         = useAuthStore((s) => s.user)
  const token        = useAuthStore((s) => s.accessToken)
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const online       = useOnlineStatus(Boolean(token))
  const outletId     = useSettingsStore((s) => s.outletId)
  const outletLabel  = useSettingsStore((s) => s.outletLabel)

  const canCreate = hasPermission('operation:stock-bf:create')
  const canView   = hasPermission('operation:stock-bf:view')

  const [products, setProducts] = useState<ProductRow[]>([])
  const [search, setSearch]     = useState('')
  const [showDrop, setShowDrop] = useState(false)
  const [qty, setQty]           = useState('1')
  const [rows, setRows]         = useState<BfRow[]>([])
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [formLocked, setFormLocked] = useState(false)
  const [lockStatus, setLockStatus] = useState('')
  const [reloadNonce, setReloadNonce] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)
  const [kbField, setKbField] = useState<'search' | null>(null)
  const [pendingProduct, setPendingProduct] = useState<ProductRow | null>(null)
  const [duplicateId, setDuplicateId] = useState<string | null>(null)
  const [bfNo, setBfNo] = useState('')
  const businessDay = useSriLankaBusinessDay()

  useEffect(() => {
    if (!formLocked) return
    setKbField(null)
    setShowDrop(false)
  }, [formLocked])

  useEffect(() => {
    void (async () => {
      try {
        const list = await loadProductsIntoDb()
        setProducts(list)
        if (list.length === 0) {
          toast(
            online
              ? 'No products in local cache. On the main POS screen, wait for the catalogue to load or use refresh.'
              : 'No products offline. Connect and open the main POS to download the catalogue.',
            online ? 'info' : 'error',
          )
        }
      } catch (e) {
        console.error('[StockBf] product catalogue', e)
        toast((e as Error).message, 'error')
      }
    })()
  }, [online])

  useEffect(() => {
    if (!outletId || (!canView && !canCreate)) return
    const today = businessDay
    void (async () => {
      try {
        if (online && canView) {
          const res = (await fetchStockBfRecords({
            outletId,
            fromDate: today,
            toDate: today,
            page: 1,
            pageSize: 200,
          })) as Record<string, unknown>
          const raw = (res.stockBFs ?? res.StockBFs ?? []) as Record<string, unknown>[]
          const submitted = mapServerRows(raw, products)
          if (submitted.length > 0) {
            const blockingRaw = raw.filter((r) =>
              isBlockingStockBfStatus(String(r.status ?? r.Status ?? '')),
            )
            setFormLocked(true)
            setRows(submitted)
            setPendingProduct(null)
            setSearch('')
            setLockStatus(String(blockingRaw[0]?.status ?? blockingRaw[0]?.Status ?? 'Pending'))
            setBfNo(String(blockingRaw[0]?.bfNo ?? blockingRaw[0]?.BFNo ?? ''))
          } else if (!submittingRef.current) {
            const localForDay = (await offlineDb.stockBf.toArray()).filter(
              (r) => r.outletId === outletId && r.processDate === today,
            )
            for (const row of localForDay) {
              await offlineDb.stockBf.delete(row.id)
            }
            setFormLocked(false)
            setLockStatus('')
            setRows([])
            setBfNo('')
          }
          return
        }

        const local = (await offlineDb.stockBf.toArray()).filter(
          (r) => r.outletId === outletId && r.processDate === today,
        )
        if (local.length > 0) {
          const latest = local.sort((a, b) => b.createdAt - a.createdAt)[0]
          setFormLocked(true)
          setLockStatus(latest.synced ? 'Submitted' : 'Queued')
          setRows(latest.lines.map((l) => ({ productId: l.productId, code: l.code, name: l.name, qty: l.qty })))
          setPendingProduct(null)
          setSearch('')
        } else if (!submittingRef.current) {
          setFormLocked(false)
          setLockStatus('')
          setRows([])
        }
      } catch (e) {
        if (!submittingRef.current) {
          toast((e as Error).message, 'error')
        }
      }
    })()
  }, [online, outletId, canView, canCreate, reloadNonce, products, businessDay])

  const filtered = useMemo(
    () => filterItemChoices(products, search, { posOnly: true, requireOpenStockOnly: true, limit: 20 }),
    [products, search],
  )

  function focusQtySelected() {
    setQty('01.00')
    window.setTimeout(() => {
      const el = qtyRef.current
      if (!el) return
      el.focus()
      el.select()
    }, 0)
  }

  function focusSearch() {
    window.setTimeout(() => {
      const el = searchRef.current
      if (!el) return
      el.focus()
      el.select()
    }, 0)
  }

  function selectProduct(p: ProductRow) {
    if (formLocked) {
      toast('Opening stock for today is already submitted and locked.', 'error')
      return
    }
    if (p.displayInPOS === false) {
      toast('This product is not displayed in POS — it cannot be added to Stock BF.', 'error')
      return
    }
    if (p.requireOpenStock !== true) {
      toast('This product does not require open stock — it cannot be added to Stock BF.', 'error')
      return
    }
    setPendingProduct(p)
    setSearch(formatSelectedItemSearchLabel(p))
    setShowDrop(false)
    setKbField(null)
    const already = rows.some((r) => r.productId === p.id)
    setDuplicateId(already ? p.id : null)
    focusQtySelected()
    if (already) {
      window.setTimeout(() => {
        document.getElementById(`stock-bf-line-${p.id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }, 0)
    }
  }

  function addRow(p?: ProductRow) {
    if (formLocked) {
      toast('Opening stock for today is already submitted and locked.', 'error')
      return
    }
    const target = p ?? pendingProduct
    if (!target) { toast('Select an item first.', 'info'); focusSearch(); return }
    if (target.displayInPOS === false) {
      toast('This product is not displayed in POS — it cannot be added to Stock BF.', 'error')
      return
    }
    if (target.requireOpenStock !== true) {
      toast('This product does not require open stock — it cannot be added to Stock BF.', 'error')
      return
    }
    const qn = parseStockBfQty(normalizeStockBfQtyInput(qty))
    if (qn == null) { toast('Enter a valid quantity.', 'error'); return }
    setRows((prev) => {
      const existing = prev.find((x) => x.productId === target.id)
      if (existing) return prev.map((x) => x.productId === target.id ? { ...x, qty: qn } : x)
      return [...prev, { productId: target.id, code: target.code, name: target.name, qty: qn }]
    })
    setPendingProduct(null)
    setDuplicateId(null)
    setSearch('')
    setQty('01.00')
    setShowDrop(false)
    setKbField(null)
    focusSearch()
  }

  function removeRow(productId: string) {
    if (formLocked) return
    setRows((prev) => prev.filter((r) => r.productId !== productId))
  }

  function updateRowQty(productId: string, value: string) {
    if (formLocked) return
    const qn = parseStockBfQty(normalizeStockBfQtyInput(value))
    if (qn == null) return
    setRows((prev) => prev.map((r) => r.productId === productId ? { ...r, qty: qn } : r))
  }

  function normalizeAddQtyField() {
    setQty((current) => normalizeStockBfQtyInput(current))
  }

  async function submit(andPrint = false) {
    if (submittingRef.current) return
    if (formLocked) { toast('Opening stock for today is already submitted and locked.', 'error'); return }
    if (!canCreate) { toast('You do not have permission to submit opening stock.', 'error'); return }
    if (!outletId) { toast('Select a showroom on the main POS first.', 'error'); return }
    if (rows.length === 0) { toast('Add at least one product.', 'info'); return }

    const processDateStr = todayCalendarISO()
    const mutationId = crypto.randomUUID()
    const snapshot = rows.map((r) => ({ ...r }))
    const payload = {
      bfDate: processDateStr,
      outletId,
      clientMutationId: mutationId,
      items: snapshot.map((r) => ({ productId: r.productId, quantity: r.qty })),
    }

    submittingRef.current = true
    setSubmitting(true)
    try {
      let printedBfNo = ''
      if (online) {
        try {
          const created = await postStockBfBulk(payload)
          printedBfNo = extractBfNoFromBulkResponse(created)
        } catch (firstErr) {
          const msg = formatSubmitError(firstErr).toLowerCase()
          if (msg.includes('already submitted')) throw firstErr
          if (!isConflictStatus(firstErr) && !isAlreadyRecordedError(firstErr)) throw firstErr
        }
        await offlineDb.stockBf.put({
          id: mutationId,
          outletId,
          processDate: processDateStr,
          lines: snapshot.map((r) => ({ productId: r.productId, code: r.code, name: r.name, qty: r.qty })),
          createdAt: Date.now(),
          synced: true,
        })
      } else {
        await enqueueMutation({ id: mutationId, type: 'stock-bf-bulk', payload, createdAt: Date.now() })
        await offlineDb.stockBf.put({
          id: mutationId,
          outletId,
          processDate: processDateStr,
          lines: snapshot.map((r) => ({ productId: r.productId, code: r.code, name: r.name, qty: r.qty })),
          createdAt: Date.now(),
          synced: false,
        })
      }

      if (printedBfNo) setBfNo(printedBfNo)

      if (andPrint) {
        try {
          const printed = await printStockBfHtml({
            showroom: outletLabel || 'Showroom',
            user: cashier === '—' ? '' : cashier,
            dateLabel: today,
            bfNo: printedBfNo,
            lines: snapshot.map((r) => ({ code: r.code, name: r.name, qty: r.qty })),
          })
          if (!printed) toast('Opening stock saved. Printing failed — reprint if needed.', 'info')
        } catch (printErr) {
          console.warn('[StockBf] print failed', printErr)
          toast('Opening stock saved. Printing failed — reprint if needed.', 'info')
        }
      }

      setRows(snapshot)
      setFormLocked(true)
      setLockStatus(online ? 'Pending' : 'Queued')
      setPendingProduct(null)
      setSearch('')
      setQty('01.00')
      setReloadNonce((n) => n + 1)
      toast(online ? 'Opening stock saved.' : 'Queued — will sync when online.', 'success')
      if (andPrint) onBack()
    } catch (e) {
      if (online && isUnreachableNetworkError(e)) {
        try {
          await enqueueMutation({ id: mutationId, type: 'stock-bf-bulk', payload, createdAt: Date.now() })
          await offlineDb.stockBf.put({
            id: mutationId,
            outletId,
            processDate: processDateStr,
            lines: snapshot.map((r) => ({ productId: r.productId, code: r.code, name: r.name, qty: r.qty })),
            createdAt: Date.now(),
            synced: false,
          })
          setRows(snapshot)
          setFormLocked(true)
          setLockStatus('Queued')
          toast('Server unreachable. Opening stock queued for sync.', 'info')
          if (andPrint) onBack()
        } catch {
          toast(formatSubmitError(e), 'error')
        }
      } else {
        toast(formatSubmitError(e), 'error')
      }
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const cashier = user ? `${user.firstName} ${user.lastName}`.trim() : '—'
  const today   = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  const statusLabel = formLocked
    ? (lockStatus.toLowerCase() === 'approved' ? 'Approved' : lockStatus.toLowerCase() === 'queued' ? 'Queued' : 'Submitted')
    : 'Ready'

  if (!canCreate && !canView) {
    return (
      <PosSubPageLayout title="Stock BF" subtitle="Opening stock" onBack={onBack}>
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You do not have permission to use Stock BF on this terminal.
        </p>
      </PosSubPageLayout>
    )
  }

  return (
    <PosSubPageLayout
      title="Stock BF"
      subtitle="Submit opening stock for today. Search lists only POS products with Require Open Stock."
      onBack={onBack}
      badge={
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${online ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
          {online ? 'Online' : 'Offline — queued'}
        </span>
      }
    >
      <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-lg sm:p-8">
        <CatalogStaleBanner online={online} />
        {formLocked ? (
          <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--neutral-50)] px-4 py-3 text-sm font-medium text-[var(--foreground)]">
            Today’s opening stock is submitted and locked. It can be entered again only if DMS rejects it.
          </div>
        ) : null}

        <div className="mb-6 grid grid-cols-2 gap-4 rounded-xl border border-[var(--border)] bg-[var(--neutral-50)] px-5 py-4 text-sm sm:grid-cols-5">
          <InfoField label="Showroom" value={outletLabel || '—'} />
          <InfoField label="Date" value={today} />
          <InfoField label="BF No" value={bfNo || '—'} />
          <InfoField label="Cashier" value={cashier} />
          <InfoField label="Status" value={statusLabel} />
        </div>

        {!formLocked ? (
          <div className="relative mb-4 flex flex-wrap items-end gap-3">
            <ItemSearchField
              value={search}
              onChange={(next) => {
                setSearch(next)
                setPendingProduct(null)
              }}
              inputRef={searchRef}
              open={showDrop}
              onOpenChange={setShowDrop}
              items={filtered}
              onSelect={selectProduct}
              onOpenKeyboard={() => setKbField('search')}
            />

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Qty</label>
              <QtyStepper
                value={qty}
                onChange={setQty}
                inputRef={qtyRef}
                onBlur={normalizeAddQtyField}
                onEnter={() => {
                  normalizeAddQtyField()
                  addRow()
                }}
              />
            </div>

            <button type="button"
              className="pos-tap flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-6 py-3 font-bold text-white shadow hover:bg-[var(--brand-primary-dark)]"
              onClick={() => addRow()}>
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        ) : null}

        <div className={`overflow-hidden rounded-xl border border-[var(--border)] ${formLocked ? 'bg-[var(--neutral-50)]' : ''}`}>
          <table className="w-full text-sm">
            <thead className="bg-[var(--neutral-50)] text-xs font-semibold uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 text-left">Item Code</th>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-right">Qty</th>
                {!formLocked ? <th className="w-10 px-4 py-3" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={formLocked ? 3 : 4} className="px-4 py-10 text-center text-sm text-[var(--neutral-400)]">
                    No items added.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.productId}
                    id={`stock-bf-line-${r.productId}`}
                    className={`${formLocked ? '' : 'hover:bg-[var(--neutral-50)]'} ${duplicateId === r.productId ? 'bg-amber-50' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[var(--muted-foreground)]">{r.code}</td>
                    <td className="px-4 py-3 font-medium text-[var(--foreground)]">{r.name}</td>
                    <td className="px-4 py-3 text-right">
                      {formLocked ? (
                        <span className="tabular-nums font-semibold text-[var(--foreground)]">{formatStockBfQty(r.qty)}</span>
                      ) : (
                        <div className="flex justify-end">
                          <QtyStepper
                            compact
                            value={formatStockBfQty(r.qty)}
                            onChange={(next) => updateRowQty(r.productId, next)}
                            onBlur={() => updateRowQty(r.productId, formatStockBfQty(r.qty))}
                            ariaLabel={`Quantity for ${r.name}`}
                          />
                        </div>
                      )}
                    </td>
                    {!formLocked ? (
                      <td className="px-4 py-3">
                        <button type="button" className="pos-tap rounded-lg p-1 text-red-500 hover:bg-red-50" onClick={() => removeRow(r.productId)}>
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {kbField && !formLocked ? (
          <SearchKeyboard
            value={search}
            onChange={(next) => {
              setSearch(next)
              setShowDrop(true)
            }}
            onClose={() => setKbField(null)}
            onEnter={() => {
              if (search.trim() && filtered[0]) selectProduct(filtered[0])
            }}
            label="Item search"
            placeholder="Search item code or name"
            forItemCode
          />
        ) : null}

        {!formLocked ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" disabled={rows.length === 0 || submitting || !canCreate}
              onClick={() => void submit(false)}
              className="pos-tap rounded-xl bg-[var(--brand-primary)] px-8 py-3 font-bold text-white shadow hover:bg-[var(--brand-primary-dark)] disabled:opacity-40">
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
            <button type="button" disabled={rows.length === 0 || submitting || !canCreate}
              onClick={() => void submit(true)}
              className="pos-tap flex items-center gap-2 rounded-xl bg-[var(--brand-accent)] px-8 py-3 font-bold text-neutral-900 shadow hover:brightness-95 disabled:opacity-40">
              <Printer className="h-4 w-4" /> Submit &amp; Print
            </button>
          </div>
        ) : null}
      </div>
    </PosSubPageLayout>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-0.5 font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  )
}
