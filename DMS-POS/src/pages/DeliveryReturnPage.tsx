import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { PosSubPageLayout } from '../components/PosSubPageLayout'
import { CatalogStaleBanner } from '../components/CatalogStaleBanner'
import { useAuthStore } from '../lib/auth-store'
import { useSettingsStore } from '../lib/settings-store'
import { loadAllActiveProducts } from '../lib/catalog-sync'
import type { ProductRow } from '../lib/types'
import { createDeliveryReturn, recordId } from '../lib/api'
import { useOnlineStatus } from '../lib/use-online-status'
import { toast } from '../lib/toast-store'
import { formatSubmitError } from '../lib/api-errors'
import { SearchKeyboard } from '../components/SearchKeyboard'
import { ItemSearchField, filterItemChoices } from '../components/ItemSearchField'
import { QtyStepper } from '../components/QtyStepper'
import { printReturnNotes } from '../lib/print-return-note'
import { useSriLankaBusinessDay } from '../lib/use-sri-lanka-business-day'

type Props = { onBack: () => void }
type DRow = { productId: string; name: string; code: string; qty: number }

export function DeliveryReturnPage({ onBack }: Props) {
  const user       = useAuthStore((s) => s.user)
  const token      = useAuthStore((s) => s.accessToken)
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const online     = useOnlineStatus(Boolean(token))
  const outletId   = useSettingsStore((s) => s.outletId)
  const outletLabel = useSettingsStore((s) => s.outletLabel)

  const canCreate = hasPermission('operation:delivery-return:create')
  const businessDay = useSriLankaBusinessDay()

  const [nowClock, setNowClock]         = useState(() => new Date())
  const [comment, setComment]           = useState('')
  const [products, setProducts]         = useState<ProductRow[]>([])
  const [search, setSearch]             = useState('')
  const [showDrop, setShowDrop]         = useState(false)
  const [qty, setQty]                   = useState('1')
  const [rows, setRows]                 = useState<DRow[]>([])
  const [submitting, setSubmitting]     = useState(false)
  const [kbField, setKbField]           = useState<'comment' | 'search' | null>(null)
  const [duplicateId, setDuplicateId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void (async () => {
      try {
        const list = await loadAllActiveProducts()
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
        console.error('[DeliveryReturn] product catalogue', e)
        toast((e as Error).message, 'error')
      }
    })()
  }, [online])

  useEffect(() => {
    const id = window.setInterval(() => setNowClock(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    setRows([])
    setComment('')
    setSearch('')
    setQty('1')
  }, [businessDay])

  const filtered = useMemo(
    () => filterItemChoices(products, search, { limit: 20 }),
    [products, search],
  )

  function focusSearch() {
    window.setTimeout(() => {
      const el = searchRef.current
      if (!el) return
      el.focus()
      el.select()
    }, 0)
  }

  /** Dropdown / keyboard pick: add immediately with current Qty. */
  function addProductFromSearch(p: ProductRow) {
    addRow(p)
  }

  function addRow(p?: ProductRow) {
    let target = p
    if (!target && search.trim()) {
      const matches = filterItemChoices(products, search, { limit: 2 })
      if (matches.length === 1) target = matches[0]
    }
    if (!target) { toast('Select an item first.', 'info'); focusSearch(); return }
    const qn = parseFloat(qty.replace(',', '.'))
    if (!Number.isFinite(qn) || qn <= 0) { toast('Enter a valid quantity.', 'error'); return }
    const scrollExisting = rows.some((r) => r.productId === target!.id)
    setRows((prev) => {
      const existing = prev.find((x) => x.productId === target!.id)
      if (existing) return prev.map((x) => x.productId === target!.id ? { ...x, qty: qn } : x)
      return [...prev, { productId: target!.id, name: target!.name, code: target!.code, qty: qn }]
    })
    if (scrollExisting) {
      window.setTimeout(() => {
        document.getElementById(`return-line-${target!.id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }, 0)
    }
    setDuplicateId(null)
    setSearch('')
    setQty('1')
    setShowDrop(false)
    setKbField(null)
    focusSearch()
  }

  function removeRow(id: string) { setRows((prev) => prev.filter((r) => r.productId !== id)) }

  function updateRowQty(productId: string, value: string) {
    const qn = parseFloat(value.replace(',', '.'))
    if (!Number.isFinite(qn) || qn <= 0) return
    setRows((prev) => prev.map((r) => r.productId === productId ? { ...r, qty: qn } : r))
  }

  async function submit() {
    if (!canCreate) { toast('You do not have permission to submit delivery returns.', 'error'); return }
    if (!online) { toast('Delivery returns require an online connection.', 'error'); return }
    if (!outletId) { toast('Choose your showroom on the main POS first.', 'error'); return }
    if (rows.length === 0) { toast('Add at least one product line.', 'error'); return }
    const snapshot = rows.map((r) => ({ ...r }))
    const commentSnap = comment.trim()
    const cashierName = user ? `${user.firstName} ${user.lastName}`.trim() : '—'
    const submittedAt = new Date().toISOString()
    setSubmitting(true)
    try {
      const now = new Date()
      const created = (await createDeliveryReturn({
        deliveryNo: `POS-${now.getTime()}`,
        deliveredDate: now.toISOString(),
        returnDate: now.toISOString(),
        outletId,
        reason: commentSnap || 'Return from showroom',
        items: snapshot.map((r) => ({ productId: r.productId, quantity: r.qty })),
      })) as Record<string, unknown>
      const rec = (created && typeof created === 'object') ? (created as Record<string, unknown>) : {}
      const returnNo = String(rec.returnNo ?? rec.ReturnNo ?? '').trim()
      if (!recordId(created) && !returnNo) throw new Error('No return ID returned.')
      const status = String(rec.status ?? rec.Status ?? '')
      setRows([]); setComment('')
      const approved = status.toLowerCase() === 'approved'
      toast(approved ? 'Return approved. Printing copy then original…' : 'Return submitted. Printing copy then original…', 'success')
      try {
        await printReturnNotes({
          returnNo: returnNo || '—',
          submittedAt,
          showroom: outletLabel || '—',
          submittedBy: cashierName || '—',
          comment: commentSnap,
          lines: snapshot.map((r) => ({ code: r.code, name: r.name, qty: r.qty })),
        })
      } catch (printErr) {
        console.warn('[DeliveryReturn] print failed', printErr)
        toast('Return saved. Printing the notes failed — reprint from the printer if needed.', 'info')
      }
    } catch (e) {
      toast(formatSubmitError(e), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const cashier = user ? `${user.firstName} ${user.lastName}`.trim() : '—'

  if (!canCreate) {
    return (
      <PosSubPageLayout title="Delivery Return" subtitle="Return items to warehouse." onBack={onBack}>
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You do not have permission to submit delivery returns on this terminal.
        </p>
      </PosSubPageLayout>
    )
  }

  return (
    <PosSubPageLayout
      title="Delivery Return"
      subtitle="Return items to main warehouse."
      onBack={onBack}
      badge={
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${online ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
          {online ? 'Online' : 'Offline — online required'}
        </span>
      }
    >
      <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-lg sm:p-8">
        <CatalogStaleBanner online={online} />
        {/* Info strip */}
        <div className="mb-6 grid grid-cols-2 gap-4 rounded-xl border border-[var(--border)] bg-[var(--neutral-50)] px-5 py-4 text-sm sm:grid-cols-4">
          <div><p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Showroom</p><p className="mt-0.5 font-semibold text-[var(--foreground)]">{outletLabel || '—'}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Date</p><p className="mt-0.5 font-semibold tabular-nums text-[var(--foreground)]">{nowClock.toLocaleString()}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Cashier</p><p className="mt-0.5 font-semibold text-[var(--foreground)]">{cashier}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Status</p><p className="mt-0.5 font-semibold text-[var(--foreground)]">Ready</p></div>
        </div>

        {/* Optional comment */}
        <div className="mb-5">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Comment (optional)</label>
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); setKbField('comment') }}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--neutral-50)] px-4 py-3 text-left text-[var(--foreground)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
          >
            {comment || <span className="text-[var(--neutral-400)]">Optional comment</span>}
          </button>
        </div>

        <div className="mb-5">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Return Date</label>
          <input
            value={nowClock.toLocaleString()}
            readOnly
            disabled
            className="w-full cursor-not-allowed rounded-xl border border-[var(--border)] bg-[var(--neutral-100)] px-4 py-3 text-[var(--foreground)] opacity-80"
          />
        </div>

        {/* Search row */}
        <div className="relative mb-4 flex flex-wrap items-end gap-3">
          <ItemSearchField
            value={search}
            onChange={setSearch}
            inputRef={searchRef}
            open={showDrop}
            onOpenChange={setShowDrop}
            items={filtered}
            onSelect={addProductFromSearch}
            onOpenKeyboard={() => setKbField('search')}
          />
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Qty</label>
            <QtyStepper
              value={qty}
              onChange={setQty}
              inputRef={qtyRef}
              onEnter={() => addRow()}
            />
          </div>
          <button type="button"
            className="pos-tap flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-6 py-3 font-bold text-white shadow hover:bg-[var(--brand-primary-dark)]"
            onClick={() => addRow()}>
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>

        {/* Items table */}
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--neutral-50)] text-xs font-semibold uppercase text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 text-left">Item Code</th>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-[var(--neutral-400)]">No items added.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.productId}
                    id={`return-line-${r.productId}`}
                    className={`hover:bg-[var(--neutral-50)] ${duplicateId === r.productId ? 'bg-amber-50' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[var(--muted-foreground)]">{r.code}</td>
                    <td className="px-4 py-3 font-medium text-[var(--foreground)]">{r.name}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end">
                        <QtyStepper compact value={r.qty} onChange={(next) => updateRowQty(r.productId, next)} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" className="pos-tap rounded-lg p-1 text-red-500 hover:bg-red-50" onClick={() => removeRow(r.productId)}>
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {kbField ? (
          <SearchKeyboard
            key={kbField}
            value={kbField === 'comment' ? comment : search}
            onChange={(next) => {
              if (kbField === 'comment') {
                setComment(next)
                return
              }
              setSearch(next)
              setShowDrop(true)
            }}
            onClose={() => setKbField(null)}
            onEnter={() => {
              if (kbField === 'search' && search.trim() && filtered[0]) addProductFromSearch(filtered[0])
            }}
            label={kbField === 'comment' ? 'Comment' : 'Item search'}
            placeholder={kbField === 'comment' ? 'Optional comment' : 'Search item code or name'}
            forItemCode={kbField === 'search'}
          />
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" disabled={submitting || !online || rows.length === 0}
            onClick={() => void submit()}
            className="pos-tap rounded-xl bg-[var(--brand-primary)] px-8 py-3 font-bold text-white shadow hover:bg-[var(--brand-primary-dark)] disabled:opacity-40">
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
          {!online ? <p className="self-center text-sm text-amber-700">Online connection required.</p> : null}
        </div>
      </div>
    </PosSubPageLayout>
  )
}
