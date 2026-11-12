import {
  useCallback, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react'
import {
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Check,
  Cloud, History, Inbox, LogOut, Menu,
  Minus, Package, Plus, Printer, Bell,
  Search, Star, Truck, Undo2,
  Pause, Trash2, Wallet, X, Maximize2, Power, Stethoscope, UserRound,
} from 'lucide-react'
import { useAuthStore } from '../lib/auth-store'
import { useCartStore } from '../lib/cart-store'
import { useHeldBillStore } from '../lib/held-bill-store'
import { useFavoriteStore } from '../lib/favorite-store'
import { useSettingsStore } from '../lib/settings-store'
import { syncCatalogFromServer } from '../lib/catalog-sync'
import { fetchOutletsPage, fetchPendingTransferCount, fetchPosSaleRecordsUnreadCount, postPosSale, resolveOutletByPosVerificationCode, getOrCreatePosDeviceId, postPosDeviceHeartbeat } from '../lib/api'
import { enqueueMutation, processPendingQueue } from '../lib/sync-queue'
import { useOnlineStatus } from '../lib/use-online-status'
import { isElectronPos, printReceiptHtml, type PrintReceiptOpts } from '../lib/print-receipt'
import {
  formatReceiptContact,
  formatShowroomBillPhone,
  RECEIPT_COMPANY_ADDRESS,
  RECEIPT_COMPANY_NAME,
  RECEIPT_FOOD_POLICY,
} from '../lib/receipt-company'
import { toast } from '../lib/toast-store'
import { formatSubmitError, isUnreachableNetworkError } from '../lib/api-errors'
import { useSriLankaBusinessDay } from '../lib/use-sri-lanka-business-day'
import { OnlineBadge } from '../components/OnlineBadge'
import { PaymentModal } from '../components/PaymentModal'
import { PostSalePopups, type PostSaleState } from '../components/PostSalePopups'
import { pushCustomerThankYou } from '../hooks/use-customer-display-sync'
import { PrintPreviewModal } from '../components/PrintPreviewModal'
import { TransactionHistoryModal } from '../components/TransactionHistoryModal'
import { QtyNumpad } from '../components/QtyNumpad'
import { SearchKeyboard } from '../components/SearchKeyboard'
import { DiagnosticPage } from './DiagnosticPage'
import type { CategoryRow, ProductRow } from '../lib/types'
import { filterByCodeOrName } from '../lib/product-search'
import { offlineDb } from '../lib/offline-db'
import type { Screen } from '../screen-types'

// ─── Category pill colours (cycles through palette) ──────────────────────────
const CAT_COLOURS = [
  'bg-[var(--cat-0)] text-neutral-900',    // gold (accent)
  'bg-[var(--cat-1)] text-neutral-900',    // red (primary)
  'bg-[var(--cat-2)] text-neutral-900',    // green
  'bg-[var(--cat-3)] text-neutral-900',    // blue
  'bg-[var(--cat-4)] text-neutral-900',    // purple
  'bg-[var(--cat-5)] text-neutral-900',    // orange
  'bg-[var(--cat-6)] text-neutral-900',    // pink
  'bg-[var(--cat-7)] text-neutral-900',    // teal
]

type NumpadTarget = { productId: string; name: string; currentQty: number }

type PosMainPageProps = {
  onOpenScreen: (s: Screen) => void
}

export function PosMainPage({ onOpenScreen }: PosMainPageProps) {
  const user        = useAuthStore((s) => s.user)
  const logout      = useAuthStore((s) => s.logout)
  const accessToken = useAuthStore((s) => s.accessToken)
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const online      = useOnlineStatus(Boolean(accessToken))

  const canSaleCreate    = hasPermission('pos:sale:create')
  const canSaleView      = hasPermission('pos:sale:view')
  const canStockBfCreate = hasPermission('operation:stock-bf:create')
  const canStockBfView   = hasPermission('operation:stock-bf:view')
  const canTransferCreate = hasPermission('operation:transfer:create')
  const canTransferView   = hasPermission('operation:transfer:view')
  const canDeliveryReturnCreate = hasPermission('operation:delivery-return:create')
  const canCashierBalanceView = hasPermission('cashier-balance:view')
  const canCashierBalanceEdit = hasPermission('cashier-balance:edit')
  const canSaleRecordsView =
    hasPermission('pos:sale-records:view') || hasPermission('pos:sale:view')
  const businessDay = useSriLankaBusinessDay()

  const outletId    = useSettingsStore((s) => s.outletId)
  const outletLabel = useSettingsStore((s) => s.outletLabel)
  const assignedShowroomCode = useSettingsStore((s) => s.assignedShowroomCode)
  const setOutlet   = useSettingsStore((s) => s.setOutlet)
  const apiBaseUrl  = useSettingsStore((s) => s.apiBaseUrl)
  const zoomPercent = useSettingsStore((s) => s.zoomPercent)
  const setZoom     = useSettingsStore((s) => s.setZoomPercent)
  const productTilePercent = useSettingsStore((s) => s.productTilePercent)
  const setProductTilePercent = useSettingsStore((s) => s.setProductTilePercent)

  const cashierName = [user?.firstName, user?.lastName].filter((p) => Boolean(p && p.trim())).join(' ').trim()
    || user?.email
    || 'User'
  const cashierRole = user?.roles?.find((r) => r.name)?.name || (user?.isSuperAdmin ? 'Admin' : 'Cashier')

  const lines    = useCartStore((s) => s.lines)
  const add      = useCartStore((s) => s.add)
  const inc      = useCartStore((s) => s.inc)
  const dec      = useCartStore((s) => s.dec)
  const remove   = useCartStore((s) => s.remove)
  const subtotal = useCartStore((s) => s.subtotal)
  const clear    = useCartStore((s) => s.clear)
  const setCartLines = useCartStore((s) => s.setLines)
  const applyCatalogPrices = useCartStore((s) => s.applyCatalogPrices)
  const holdBill = useHeldBillStore((s) => s.hold)
  const recallHeldBill = useHeldBillStore((s) => s.recall)
  const removeHeldBill = useHeldBillStore((s) => s.remove)
  const heldBillsAll = useHeldBillStore((s) => s.bills)
  const heldBills = useMemo(
    () => (outletId ? heldBillsAll.filter((b) => b.outletId === outletId).sort((a, b) => b.heldAt - a.heldAt) : []),
    [heldBillsAll, outletId],
  )

  const toggleFav = useFavoriteStore((s) => s.toggle)
  const isFav     = useFavoriteStore((s) => s.isFav)
  const favIds    = useFavoriteStore((s) => s.ids)

  const [drawer, setDrawer]           = useState(false)
  const [userMenu, setUserMenu]       = useState(false)
  const [showroomBindError, setShowroomBindError] = useState('')
  const [search, setSearch]           = useState('')
  const [categoryId, setCategoryId]   = useState<string>('all')
  const [payOpen, setPayOpen]         = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [loadErr, setLoadErr]         = useState('')
  const [numpad, setNumpad]           = useState<NumpadTarget | null>(null)
  const [products, setProducts]       = useState<ProductRow[]>([])
  const [categories, setCategories]   = useState<CategoryRow[]>([])
  const [outlets, setOutlets]         = useState<{ id: string; code: string; name: string; address?: string; phone?: string }[]>([])
  const [lastReceipt, setLastReceipt] = useState<{
    outletLabel: string; total: number; paymentMethod: string; cash: number; change: number
    saleNo?: string; dateTime?: string; lines: { name: string; unitPrice: number; qty: number; amount: number }[]
  } | null>(null)
  const [pendingInfo, setPendingInfo] = useState<{
    count: number
    byType: { type: string; count: number; maxRetry: number }[]
  }>({ count: 0, byType: [] })
  const [syncPopoverOpen, setSyncPopoverOpen] = useState(false)
  const [diagnosticOpen, setDiagnosticOpen] = useState(false)
  const [searchKbOpen, setSearchKbOpen] = useState(false)
  const [previewOpts, setPreviewOpts] = useState<PrintReceiptOpts | null>(null)
  const [postSale, setPostSale] = useState<PostSaleState | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [heldListOpen, setHeldListOpen] = useState(false)
  const [recallConfirmId, setRecallConfirmId] = useState<string | null>(null)
  const [confirmShutdown, setConfirmShutdown] = useState(false)
  const [shuttingDown, setShuttingDown] = useState(false)
  const [catsExpanded, setCatsExpanded] = useState(false)
  const [saleRecordUnread, setSaleRecordUnread] = useState(0)
  const [pendingTransferCount, setPendingTransferCount] = useState(0)
  const POS_TILE_BASE_PX = 172

  const catalogScrollRef = useRef<HTMLDivElement>(null)
  const catScrollRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const scale = zoomPercent / 100
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const longPressTriggeredRef = useRef(false)

  // ── Catalog load ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoadErr('')
    try {
      if (online) {
        await syncCatalogFromServer()
      } else if (accessToken) {
        // Health ping may lag after login — try sync once; login flow also syncs.
        try {
          await syncCatalogFromServer()
        } catch {
          /* offline or transient; fall back to local cache */
        }
      }
      const p = await offlineDb.products.toArray()
      const c = await offlineDb.categories.toArray()
      setProducts(p)
      setCategories(c)
      applyCatalogPrices(p.map((row) => ({ productId: row.id, unitPrice: row.unitPrice })))
      if (p.length === 0) {
        setLoadErr(
          online
            ? 'No products in cache. Open POS Diagnostic → Re-sync from Server.'
            : 'No products in cache. Connect online to download the catalogue.',
        )
      }
    } catch (e) {
      setLoadErr((e as Error).message)
      const p = await offlineDb.products.toArray()
      const c = await offlineDb.categories.toArray()
      setProducts(p)
      setCategories(c)
      applyCatalogPrices(p.map((row) => ({ productId: row.id, unitPrice: row.unitPrice })))
    }
  }, [online, accessToken, businessDay, applyCatalogPrices])

  useEffect(() => { void loadData() }, [loadData])

  // ── Outlets load (re-fetch when API URL / online changes — not only on login) ─
  useEffect(() => {
    if (!accessToken || !online) return
    let cancelled = false
    void (async () => {
      const mapOutlet = (o: Record<string, unknown>) => ({
        id: String(o.id ?? o.Id ?? ''),
        code: String(o.code ?? o.Code ?? ''),
        name: String(o.name ?? o.Name ?? ''),
        address: String(o.address ?? o.Address ?? ''),
        phone: String(o.phone ?? o.Phone ?? '').trim(),
      })

      try {
        const data = await fetchOutletsPage(1, 100)
        if (!cancelled) {
          setOutlets((data.outlets as Record<string, unknown>[]).map(mapOutlet).filter((o) => o.id))
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[outlets] Failed to load showroom list:', err)
        }
      }

      const cfg = (await window.dmsPos?.getSecureConfig?.()) ?? (await window.dmsPos?.getConfig?.())
      if (cancelled) return
      const fromFile = (cfg?.posVerificationCode || '').trim()
      if (fromFile) useSettingsStore.getState().setAssignedShowroomCode(fromFile)
      const isDesktop = window.dmsPos?.mode === 'electron'
      const verification = isDesktop
        ? fromFile
        : (fromFile || useSettingsStore.getState().assignedShowroomCode.trim())
      if (!verification) {
        setOutlet(null, 'Showroom')
        setShowroomBindError(
          isDesktop
            ? 'This desktop till needs a POS Verification Code before it can connect to a showroom. Press Ctrl+Shift+A to open the hidden admin panel.'
            : 'This till has no POS Verification Code. A system administrator must configure it.',
        )
        return
      }
      try {
        const match = await resolveOutletByPosVerificationCode(verification)
        if (cancelled) return
        if (!match.id) {
          setOutlet(null, 'Showroom')
          setShowroomBindError('POS Verification Code was not found in DMS. Ask an administrator to set it on the showroom.')
          return
        }
        setShowroomBindError('')
        setOutlet(match.id, match.name || match.code)
        setOutlets((prev) => {
          const existing = prev.find((o) => o.id === match.id)
          const rest = prev.filter((o) => o.id !== match.id)
          return [
            ...rest,
            {
              id: match.id,
              code: match.code,
              name: match.name || match.code,
              address: match.address,
              phone: (match.phone || existing?.phone || '').trim(),
            },
          ]
        })
      } catch {
        if (cancelled) return
        setOutlet(null, 'Showroom')
        setShowroomBindError('POS Verification Code was not found in DMS. Ask an administrator to set it on the showroom.')
      }
    })()
    return () => { cancelled = true }
  }, [accessToken, online, apiBaseUrl, assignedShowroomCode, setOutlet])

  useEffect(() => {
    if (!accessToken || !online || !canSaleRecordsView) {
      setSaleRecordUnread(0)
      return
    }
    let cancelled = false
    const tick = async () => {
      try {
        const n = await fetchPosSaleRecordsUnreadCount()
        if (!cancelled) setSaleRecordUnread(n)
      } catch {
        /* ignore poll errors */
      }
    }
    void tick()
    const id = window.setInterval(() => { void tick() }, 30000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [accessToken, online, canSaleRecordsView])

  useEffect(() => {
    if (!accessToken || !online || !canTransferView || !outletId) {
      setPendingTransferCount(0)
      return
    }
    let cancelled = false
    const tick = async () => {
      try {
        const n = await fetchPendingTransferCount(outletId, businessDay, businessDay)
        if (!cancelled) setPendingTransferCount(n)
      } catch {
        /* ignore poll errors */
      }
    }
    void tick()
    const id = window.setInterval(() => { void tick() }, 15000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [accessToken, online, canTransferView, outletId, businessDay])

  // Fleet heartbeat for Super Admin Developer Mode / siren (every 30s)
  useEffect(() => {
    if (!accessToken || !online) return
    let cancelled = false

    const beat = async () => {
      try {
        const result = (await postPosDeviceHeartbeat({
          deviceId: getOrCreatePosDeviceId(),
          outletId: outletId || undefined,
          outletName: outletLabel || undefined,
          deviceName: outletLabel || undefined,
          machineName: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 80) : undefined,
          appVersion: 'pos-web',
        })) as { pendingCommand?: string; PendingCommand?: string } | null

        const cmd = result?.pendingCommand ?? result?.PendingCommand
        if (cmd && String(cmd).toLowerCase() === 'refresh' && !cancelled) {
          void loadData()
        }
      } catch {
        /* ignore offline/permission */
      }
    }

    void beat()
    const id = window.setInterval(() => void beat(), 30_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [accessToken, online, outletId, outletLabel, loadData])

  useEffect(() => {
    if (!accessToken) {
      setPendingInfo({ count: 0, byType: [] })
      return
    }
    const tick = async () => {
      const rows = await offlineDb.pending.toArray()
      const map = new Map<string, { count: number; maxRetry: number }>()
      for (const r of rows) {
        const m = map.get(r.type) ?? { count: 0, maxRetry: 0 }
        m.count += 1
        m.maxRetry = Math.max(m.maxRetry, r.retryCount)
        map.set(r.type, m)
      }
      setPendingInfo({
        count: rows.length,
        byType: [...map.entries()].map(([type, v]) => ({ type, ...v })),
      })
    }
    void tick()
    const id = setInterval(tick, 4000)
    return () => clearInterval(id)
  }, [accessToken])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      const tag = t.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
      if (e.key === 'Escape') {
        if (payOpen) { e.preventDefault(); setPayOpen(false); return }
        if (numpad) { e.preventDefault(); setNumpad(null); return }
        if (historyOpen) { e.preventDefault(); setHistoryOpen(false); return }
        if (syncPopoverOpen) { e.preventDefault(); setSyncPopoverOpen(false) }
        return
      }
      if (e.key === '/' || e.key === 'F3') {
        if (e.key === '/' && typing) return
        e.preventDefault()
        setSearchKbOpen(true)
        return
      }
      if (e.key === 'F5') {
        e.preventDefault()
        void loadData()
        return
      }
      if (e.key === 'F10') {
        e.preventDefault()
        if (lines.length > 0 && outletId && canSaleCreate) setPayOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [payOpen, numpad, historyOpen, syncPopoverOpen, lines.length, outletId, canSaleCreate, loadData])

  // ── Filtered product list ───────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    let list = products
    if (categoryId === 'fav') list = list.filter((p) => favIds.includes(p.id))
    else if (categoryId !== 'all') list = list.filter((p) => p.categoryId === categoryId)
    list = [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
    if (search.trim()) list = filterByCodeOrName(list, search)
    return list
  }, [products, categoryId, search, favIds])

  const searchHits = useMemo(
    () => (search.trim() ? filterByCodeOrName(products, search, { limit: 12, whenEmpty: 'none' }) : []),
    [products, search],
  )

  // ── Category row ────────────────────────────────────────────────────────────
  const catRow = useMemo(() => {
    const cols: { id: string; name: string; colour: string }[] = [
      { id: 'all', name: 'All', colour: 'bg-neutral-300 text-neutral-900' },
      { id: 'fav', name: '★ Favourites', colour: CAT_COLOURS[0] },
    ]
    const sorted = [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
    sorted.forEach((c, i) => cols.push({ id: c.id, name: c.name, colour: CAT_COLOURS[(i + 1) % CAT_COLOURS.length] }))
    return cols
  }, [categories])

  function selectCategory(id: string) {
    setCategoryId(id)
  }

  function scrollCategoryStrip(dir: -1 | 1) {
    const el = catScrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  const sub = subtotal()

  // ── Current outlet details ─────────────────────────────────────────────────
  const currentOutlet = useMemo(() => outlets.find((o) => o.id === outletId), [outlets, outletId])
  const receiptCompanyAddress = RECEIPT_COMPANY_ADDRESS
  const receiptCompanyPhone = formatReceiptContact(currentOutlet?.phone)
  const receiptShowroomPhone = formatShowroomBillPhone(currentOutlet?.phone)

  function beginPostSale(receipt: {
    outletLabel: string
    total: number
    paymentMethod: string
    cash: number
    change: number
    dateTime: string
    saleNo?: string
    lines: { name: string; unitPrice: number; qty: number; amount: number }[]
  }) {
    setLastReceipt(receipt)
    clear()
    setPayOpen(false)
    pushCustomerThankYou(receipt.change)
    setPostSale({
      change: receipt.change,
      cash: receipt.cash,
      total: receipt.total,
      receiptOpts: {
        title: RECEIPT_COMPANY_NAME,
        companyAddress: receiptCompanyAddress,
        companyPhone: `Tel: ${receiptCompanyPhone}`,
        outletLabel: receipt.outletLabel,
        showroomPhone: receiptShowroomPhone || undefined,
        lines: receipt.lines,
        total: receipt.total,
        cash: receipt.cash,
        change: receipt.change,
        dateTime: receipt.dateTime,
        cashier: user ? `${user.firstName} ${user.lastName}`.trim() : '',
        paymentMethod: receipt.paymentMethod,
        saleNo: receipt.saleNo,
        footerLines: [RECEIPT_FOOD_POLICY],
      },
    })
  }

  // ── Payment ─────────────────────────────────────────────────────────────────
  async function handlePay(method: 'Cash' | 'Card', cashReceived?: number, change?: number) {
    if (!canSaleCreate) { toast('You do not have permission to complete sales.', 'error'); return }
    if (!outletId) { toast('This till is not assigned to a showroom.', 'error'); return }
    if (lines.length === 0) return

    const body = {
      outletId,
      paymentMethod: method,
      clientMutationId: crypto.randomUUID(),
      lines: lines.map((l) => ({ productId: l.productId, quantity: l.qty, unitPrice: l.unitPrice })),
    }
    const snapshot = lines.map((l) => ({ name: l.name, unitPrice: l.unitPrice, qty: l.qty, amount: l.qty * l.unitPrice }))
    const totalSnap = sub
    const now = new Date()
    const dateTimeStr = now.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) + ' ' + 
                       now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })

    const cashPaid = cashReceived ?? totalSnap
    const changeAmount = change ?? 0

    const saveLocal = async (
      saleNo?: string,
      meta?: { serverSaleId?: string; status?: string; rejectionReason?: string },
    ) => {
      await offlineDb.sales.put({
        id: body.clientMutationId,
        outletId,
        paymentMethod: method,
        total: totalSnap,
        lines: lines.map((l) => ({ productId: l.productId, name: l.name, qty: l.qty, unitPrice: l.unitPrice })),
        createdAt: Date.now(),
        synced: Boolean(saleNo),
        saleNo,
        serverSaleId: meta?.serverSaleId,
        status: meta?.status,
        rejectionReason: meta?.rejectionReason,
      })
    }

    try {
      let receiptSnapshot: {
        outletLabel: string
        total: number
        paymentMethod: string
        cash: number
        change: number
        dateTime: string
        saleNo?: string
        lines: { name: string; unitPrice: number; qty: number; amount: number }[]
      }
      if (online) {
        const detail = (await postPosSale(body)) as {
          id?: string
          saleNo?: string
          paymentMethod?: string
          PaymentMethod?: string
          totalAmount?: number
          status?: string
          lines?: { productName?: string; quantity?: number; unitPrice?: number; lineTotal?: number }[]
        }
        await saveLocal(detail.saleNo, {
          serverSaleId: detail.id != null ? String(detail.id) : undefined,
          status: detail.status != null ? String(detail.status) : undefined,
        })
        receiptSnapshot = {
          outletLabel,
          total: Number(detail.totalAmount ?? totalSnap),
          paymentMethod: String(detail.paymentMethod ?? detail.PaymentMethod ?? method),
          cash: cashPaid,
          change: changeAmount,
          dateTime: dateTimeStr,
          saleNo: detail.saleNo,
          lines: detail.lines?.length
            ? detail.lines.map((l) => ({ 
                name: String(l.productName ?? ''), 
                unitPrice: Number(l.unitPrice ?? 0),
                qty: Number(l.quantity ?? 0), 
                amount: Number(l.lineTotal ?? 0) 
              }))
            : snapshot,
        }
      } else {
        await enqueueMutation({ id: body.clientMutationId, type: 'pos-sale', payload: body, createdAt: Date.now() })
        await saveLocal()
        receiptSnapshot = { outletLabel, total: totalSnap, paymentMethod: method, cash: cashPaid, change: changeAmount, dateTime: dateTimeStr, lines: snapshot }
      }
      toast(
        online
          ? 'Sale completed successfully.'
          : 'Sale queued — will sync when online.',
        'success',
      )
      beginPostSale(receiptSnapshot)
    } catch (e) {
      if (online && isUnreachableNetworkError(e)) {
        try {
          await enqueueMutation({ id: body.clientMutationId, type: 'pos-sale', payload: body, createdAt: Date.now() })
          await saveLocal()
          const receiptSnapshot = { outletLabel, total: totalSnap, paymentMethod: method, cash: cashPaid, change: changeAmount, dateTime: dateTimeStr, lines: snapshot }
          toast('Server unreachable. Sale queued for sync.', 'info')
          beginPostSale(receiptSnapshot)
        } catch {
          toast(formatSubmitError(e), 'error')
        }
      } else {
        toast(formatSubmitError(e), 'error')
      }
    }
  }

  function handleHoldBill() {
    if (!outletId) {
      toast('Showroom is not assigned.', 'error')
      return
    }
    if (lines.length === 0) {
      if (heldBills.length > 0) setHeldListOpen(true)
      return
    }
    const saved = holdBill({ outletId, cashierName, lines })
    if (!saved) return
    setNumpad(null)
    clear()
    toast(`Bill held (${heldBills.length + 1}). Tap Hold again to recall.`, 'success')
  }

  function applyRecall(id: string) {
    const bill = recallHeldBill(id)
    if (!bill) {
      toast('Held bill was not found.', 'error')
      return
    }
    setNumpad(null)
    setCartLines(bill.lines)
    setRecallConfirmId(null)
    setHeldListOpen(false)
    toast('Held bill restored', 'success')
  }

  function handleRecallBill(id: string) {
    if (lines.length > 0) {
      setRecallConfirmId(id)
      return
    }
    applyRecall(id)
  }

  // ── Print ───────────────────────────────────────────────────────────────────
  async function handlePrint() {
    const now = new Date()
    const dateTimeStr = now.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) + ' ' +
                       now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
    const cashier = user ? `${user.firstName} ${user.lastName}`.trim() : ''
    const footerLines = [RECEIPT_FOOD_POLICY]

    let opts: PrintReceiptOpts | null = null
    if (lines.length > 0) {
      opts = {
        title: RECEIPT_COMPANY_NAME,
        companyAddress: receiptCompanyAddress,
        companyPhone: `Tel: ${receiptCompanyPhone}`,
        outletLabel,
        showroomPhone: receiptShowroomPhone || undefined,
        lines: lines.map((l) => ({ name: l.name, unitPrice: l.unitPrice, qty: l.qty, amount: l.qty * l.unitPrice })),
        total: sub,
        cash: sub,
        change: 0,
        dateTime: dateTimeStr,
        cashier,
        footerLines,
      }
    } else if (lastReceipt) {
      opts = {
        title: RECEIPT_COMPANY_NAME,
        companyAddress: receiptCompanyAddress,
        companyPhone: `Tel: ${receiptCompanyPhone}`,
        outletLabel: lastReceipt.outletLabel,
        showroomPhone: receiptShowroomPhone || undefined,
        lines: lastReceipt.lines,
        total: lastReceipt.total,
        cash: lastReceipt.cash,
        change: lastReceipt.change,
        dateTime: lastReceipt.dateTime || dateTimeStr,
        cashier,
        paymentMethod: lastReceipt.paymentMethod,
        saleNo: lastReceipt.saleNo,
        footerLines,
      }
    }
    if (!opts) {
      toast('Add items or complete a sale first.', 'info')
      return
    }
    if (isElectronPos()) {
      const ok = await printReceiptHtml(opts, { silentOnly: true })
      if (!ok) toast('Unable to print — try again.', 'error')
      return
    }
    setPreviewOpts(opts)
  }

  // ── Product tile click → quick add or long press for numpad ────────────────
  function clearItemSearch() {
    setSearch('')
    setSearchKbOpen(false)
  }

  function handleProductTap(p: ProductRow) {
    clearItemSearch()
    if (!outletId) {
      toast('Set the POS Verification Code (Ctrl+Shift+A) to connect this till to a showroom.', 'error')
      return
    }
    add({ productId: p.id, code: p.code, name: p.name, unitPrice: p.unitPrice })
  }

  function handleProductLongPressStart(p: ProductRow) {
    longPressTriggeredRef.current = false
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true
      openNumpad(p)
    }, 500) // 500ms = 0.5 seconds for long press
  }

  function handleProductLongPressEnd(p: ProductRow) {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    
    // If long press wasn't triggered, treat as quick tap
    if (!longPressTriggeredRef.current) {
      handleProductTap(p)
    }
  }

  function openNumpad(p: ProductRow) {
    const existing = lines.find((l) => l.productId === p.id)
    setNumpad({ productId: p.id, name: p.name, currentQty: existing?.qty ?? 0 })
    clearItemSearch()
  }

  function confirmNumpad(qty: number) {
    if (!numpad) return
    const existing = lines.find((l) => l.productId === numpad.productId)
    const p = products.find((x) => x.id === numpad.productId)
    if (!p) { setNumpad(null); return }

    if (!existing) {
      // Add fresh with desired qty
      for (let i = 0; i < qty; i++) add({ productId: p.id, code: p.code, name: p.name, unitPrice: p.unitPrice })
    } else {
      const diff = qty - existing.qty
      if (diff > 0) for (let i = 0; i < diff; i++) inc(p.id)
      else if (diff < 0) for (let i = 0; i < -diff; i++) dec(p.id)
    }
    setNumpad(null)
    clearItemSearch()
  }

  // ── Electron helpers ────────────────────────────────────────────────────────
  type DmsPosApi = { shutdown?: () => Promise<{ success?: boolean; error?: string } | void>; toggleFullscreen?: () => void }
  const dmsPosApi = typeof window !== 'undefined' ? (window as unknown as { dmsPos?: DmsPosApi }).dmsPos : undefined
  function handleShutdown() {
    setUserMenu(false)
    setConfirmShutdown(true)
  }
  async function confirmDeviceShutdown() {
    if (shuttingDown) return
    setShuttingDown(true)
    try {
      if (!dmsPosApi?.shutdown) {
        toast('Device shutdown is only available on the POS terminal app.', 'error')
        setConfirmShutdown(false)
        return
      }
      const result = await dmsPosApi.shutdown()
      if (result && result.success === false) {
        toast(result.error || 'Unable to shut down this device.', 'error')
        setConfirmShutdown(false)
      }
    } catch (error) {
      toast((error as Error).message || 'Unable to shut down this device.', 'error')
      setConfirmShutdown(false)
    } finally {
      setShuttingDown(false)
    }
  }
  function handleFullscreen() { dmsPosApi?.toggleFullscreen?.() }

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-white" style={{ fontSize: `${Math.min(1.1, 0.9 * scale)}rem` }}>

      {/* ── Header ── */}
      <header className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-[var(--brand-primary-dark)] bg-[var(--brand-primary)] px-3 py-2 shadow-md">
        {/* Left: menu + brand */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setDrawer(true)}
            className="pos-tap rounded-xl border border-white/30 p-2 text-white hover:bg-white/10"
            aria-label="Open operations menu">
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <div className="font-pos-title text-lg font-bold leading-tight text-white sm:text-xl">Don &amp; Sons</div>
            <div className="text-[10px] text-white/70 sm:text-xs">Point of Sale</div>
          </div>
        </div>

        {/* Right: zoom · online badge · showroom · user */}
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {/* Screen zoom (whole dashboard) */}
          <div className="flex items-center gap-0.5 rounded-lg border border-white/30 bg-white/10 px-0.5" title="Screen zoom">
            <span className="hidden pl-1.5 text-[9px] font-bold uppercase tracking-wide text-white/70 sm:inline">Screen</span>
            <button type="button" className="pos-tap px-2 text-white" onClick={() => setZoom(zoomPercent - 10)} aria-label="Screen zoom out"><Minus className="h-4 w-4" /></button>
            <span className="min-w-[2.75rem] text-center text-[11px] font-semibold text-white">{zoomPercent}%</span>
            <button type="button" className="pos-tap px-2 text-white" onClick={() => setZoom(zoomPercent + 10)} aria-label="Screen zoom in"><Plus className="h-4 w-4" /></button>
          </div>

          {/* Product button size (catalogue cards only) */}
          <div className="flex items-center gap-0.5 rounded-lg border border-white/30 bg-white/10 px-0.5" title="Product button size">
            <span className="hidden pl-1.5 text-[9px] font-bold uppercase tracking-wide text-white/70 sm:inline">Buttons</span>
            <button type="button" className="pos-tap px-2 text-white" onClick={() => setProductTilePercent(productTilePercent - 10)} aria-label="Smaller product buttons"><Minus className="h-4 w-4" /></button>
            <span className="min-w-[2.75rem] text-center text-[11px] font-semibold text-white">{productTilePercent}%</span>
            <button type="button" className="pos-tap px-2 text-white" onClick={() => setProductTilePercent(productTilePercent + 10)} aria-label="Larger product buttons"><Plus className="h-4 w-4" /></button>
          </div>

          <div className="relative">
            <OnlineBadge
              online={online}
              pendingCount={pendingInfo.count}
              onPendingClick={() => setSyncPopoverOpen((v) => !v)}
            />
            {syncPopoverOpen && pendingInfo.count > 0 ? (
              <>
              <button
                type="button"
                className="fixed inset-0 z-[55] cursor-default"
                aria-label="Close pending sync"
                onClick={() => setSyncPopoverOpen(false)}
              />
              <div className="absolute right-0 top-full z-[60] mt-1 w-72 rounded-xl border border-[var(--border)] bg-white p-3 shadow-2xl">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted-foreground)]">Pending sync</p>
                <ul className="mt-2 max-h-40 space-y-1.5 overflow-auto text-xs text-[var(--foreground)]">
                  {pendingInfo.byType.map((row) => (
                    <li key={row.type} className="flex justify-between gap-2 border-b border-[var(--border)] pb-1 last:border-0">
                      <span className="font-mono text-[10px] text-[var(--brand-primary)]">{row.type}</span>
                      <span className="tabular-nums text-[var(--muted-foreground)]">×{row.count} · retries ≤{row.maxRetry}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="pos-tap mt-3 w-full rounded-lg bg-[var(--brand-primary)] py-2 text-xs font-bold text-white hover:bg-[var(--brand-primary-dark)]"
                  onClick={() => {
                    void processPendingQueue(true)
                    toast('Sync queue processing…', 'info')
                    setSyncPopoverOpen(false)
                  }}
                >
                  Sync now
                </button>
              </div>
              </>
            ) : null}
          </div>

          <div
            className="flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
            title="Assigned showroom (device setting)"
          >
            <span className="max-w-[10rem] truncate">{outletId ? outletLabel : 'Showroom not assigned'}</span>
          </div>

          {canTransferView && pendingTransferCount > 0 ? (
            <button
              type="button"
              onClick={() => onOpenScreen('transfers')}
              className="relative rounded-xl border border-white/30 p-2 text-white hover:bg-white/10"
              aria-label="Pending transfers"
              title="Pending transfers"
            >
              <Inbox className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
                {pendingTransferCount > 99 ? '99+' : pendingTransferCount}
              </span>
            </button>
          ) : null}

          {canSaleRecordsView && saleRecordUnread > 0 ? (
            <button
              type="button"
              onClick={() => onOpenScreen('sale-records')}
              className="relative rounded-xl border border-white/30 p-2 text-white hover:bg-white/10"
              aria-label="Sale records"
              title="Sale records"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
                {saleRecordUnread > 99 ? '99+' : saleRecordUnread}
              </span>
            </button>
          ) : null}

          {/* Logged-in cashier */}
          <div className="relative">
            <button type="button" onClick={() => setUserMenu((v) => !v)}
              className="relative z-[51] flex max-w-[16rem] items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-white hover:bg-white/20"
              title={`${cashierName} (${cashierRole})`}
              aria-expanded={userMenu}
              aria-label={`Logged in as ${cashierName}`}>
              <UserRound className="h-4 w-4 shrink-0" />
              <span className="min-w-0 text-left">
                <span className="block truncate text-[10px] font-semibold uppercase tracking-wide text-white/70">User</span>
                <span className="block truncate text-xs font-semibold leading-tight">{cashierName}</span>
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 rotate-90" />
            </button>
            {userMenu ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default"
                  aria-label="Close user menu"
                  onClick={() => setUserMenu(false)}
                />
                <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border border-[var(--border)] bg-white py-2 shadow-xl">
                <div className="border-b border-[var(--border)] px-4 pb-2">
                  <p className="text-[10px] font-semibold uppercase text-[var(--muted-foreground)]">Logged in as</p>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{cashierName}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{cashierRole}</p>
                  {user?.email ? <p className="truncate text-[11px] text-[var(--muted-foreground)]">{user.email}</p> : null}
                </div>
                <div className="border-b border-[var(--border)] px-3 py-2 space-y-2">
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase text-[var(--muted-foreground)]">Screen zoom</p>
                    <div className="flex items-center gap-1">
                      <button type="button" className="pos-tap rounded-lg border border-[var(--border)] px-2 text-[var(--foreground)]" onClick={() => { setZoom(zoomPercent - 10); setUserMenu(false) }}>-</button>
                      <span className="flex-1 text-center text-sm font-semibold">{zoomPercent}%</span>
                      <button type="button" className="pos-tap rounded-lg border border-[var(--border)] px-2 text-[var(--foreground)]" onClick={() => { setZoom(zoomPercent + 10); setUserMenu(false) }}>+</button>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase text-[var(--muted-foreground)]">Product button size</p>
                    <div className="flex items-center gap-1">
                      <button type="button" className="pos-tap rounded-lg border border-[var(--border)] px-2 text-[var(--foreground)]" onClick={() => { setProductTilePercent(productTilePercent - 10); setUserMenu(false) }}>-</button>
                      <span className="flex-1 text-center text-sm font-semibold">{productTilePercent}%</span>
                      <button type="button" className="pos-tap rounded-lg border border-[var(--border)] px-2 text-[var(--foreground)]" onClick={() => { setProductTilePercent(productTilePercent + 10); setUserMenu(false) }}>+</button>
                    </div>
                  </div>
                </div>
                <nav className="px-2 pt-1">
                  <MenuAction icon={<Maximize2 className="h-4 w-4" />} label="Toggle fullscreen" onClick={() => { handleFullscreen(); setUserMenu(false) }} />
                  <MenuAction icon={<Cloud className="h-4 w-4" />} label="Refresh cache" onClick={() => { void loadData(); setUserMenu(false); toast('Refreshing catalogue…', 'info') }} />
                  <MenuAction icon={<Stethoscope className="h-4 w-4 text-blue-600" />} label="Diagnostic" textClass="text-blue-600" onClick={() => { setDiagnosticOpen(true); setUserMenu(false) }} />
                  <MenuAction icon={<Power className="h-4 w-4 text-amber-600" />} label="Shutdown" textClass="text-amber-700" onClick={handleShutdown} />
                  <MenuAction icon={<LogOut className="h-4 w-4 text-red-600" />} label="Logout" textClass="text-red-600" onClick={() => { logout(); setUserMenu(false) }} />
                </nav>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {/* Catalog error banner */}
      {loadErr ? (
        <div className="flex-shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <strong>Catalogue:</strong> {loadErr}
        </div>
      ) : null}

      {!outletId ? (
        <div className="flex-shrink-0 border-b border-[var(--brand-accent)] bg-[var(--brand-accent)]/20 px-4 py-2 text-sm font-medium text-amber-900">
          ⚠ {showroomBindError || 'This till is not assigned to a showroom. A POS Verification Code is required.'}
        </div>
      ) : null}

      {/* ── Main body: bill | catalog ── */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
      <div className="grid h-full min-h-0 min-w-0 grid-cols-1 overflow-hidden md:grid-cols-[minmax(380px,42%)_minmax(0,1fr)]"
        style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: `${100 / scale}%`, height: `${100 / scale}%` }}>

        {/* ── LEFT: Bill panel ── */}
        <section className="pos-bill-panel flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-[var(--border)] bg-white">

          <div className="flex-shrink-0 border-b border-[var(--border)] px-4 py-3">
            <h2 className="font-pos-title text-xl font-bold text-[var(--foreground)]">Bill</h2>
          </div>

          <div className="pos-scroll-visible min-h-0 flex-1 overflow-x-hidden">
            {lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                <p className="text-sm font-semibold text-[var(--neutral-500)]">No items yet</p>
                <p className="max-w-xs text-xs text-[var(--neutral-400)]">Tap a product on the right to add it.</p>
              </div>
            ) : (
              <table className="pos-bill-table w-full table-fixed text-left">
                <colgroup>
                  <col />
                  <col className="w-[9.5rem]" />
                  <col className="w-[5.75rem]" />
                </colgroup>
                <thead className="sticky top-0 z-10 border-b border-[var(--border)] bg-white font-semibold text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-2 py-2 text-center">Qty</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {lines.map((l) => (
                    <tr key={l.productId}>
                      <td className="pos-bill-item px-3 py-2.5 align-top text-[var(--foreground)]">
                        <span className="pos-bill-item-name">{l.name}</span>
                      </td>
                      <td className="px-2 py-2.5 align-top">
                        <div className="flex items-center justify-center gap-1.5">
                          <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white" onClick={() => remove(l.productId)} aria-label={`Remove ${l.name}`}>
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white" onClick={() => dec(l.productId)} aria-label={`Decrease ${l.name}`}>
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" className="pos-bill-qty min-w-[1.35rem] text-center font-bold tabular-nums"
                            onClick={() => setNumpad({ productId: l.productId, name: l.name, currentQty: l.qty })}>
                            {l.qty}
                          </button>
                          <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-accent)] text-neutral-900" onClick={() => inc(l.productId)} aria-label={`Increase ${l.name}`}>
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="pos-bill-amount px-3 py-2.5 align-top text-right font-semibold tabular-nums">
                        {(l.qty * l.unitPrice).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex-shrink-0 border-t border-[var(--border)] bg-white px-4 py-3 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Total</p>
              <p className="font-pos-title text-2xl font-bold tabular-nums text-[var(--foreground)]">
                Rs {sub.toFixed(2)}
              </p>
            </div>

            <button type="button" disabled={lines.length === 0 || !outletId || !canSaleCreate} onClick={() => lines.length > 0 && outletId && canSaleCreate && setPayOpen(true)}
              className="w-full rounded-lg bg-[var(--brand-primary)] py-4 text-xl font-bold tracking-wide text-white shadow-md hover:bg-[var(--brand-primary-dark)] disabled:cursor-not-allowed disabled:opacity-40">
              PAY
            </button>

            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                disabled={lines.length === 0}
                onClick={() => { if (lines.length > 0) setConfirmClear(true) }}
                className="pos-tap flex h-14 items-center justify-center rounded-lg bg-[var(--brand-primary)] text-white disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Clear bill"
              >
                <Trash2 className="h-6 w-6" />
              </button>
              <button
                type="button"
                disabled={lines.length === 0 && heldBills.length === 0}
                onClick={handleHoldBill}
                onContextMenu={(e) => {
                  e.preventDefault()
                  if (heldBills.length > 0) setHeldListOpen(true)
                }}
                className="pos-tap relative flex h-14 items-center justify-center rounded-lg bg-[var(--brand-primary)] text-white disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Hold bill"
              >
                <Pause className="h-6 w-6" />
                {heldBills.length > 0 ? (
                  <span className="absolute -right-1 -top-1 min-w-[1.25rem] rounded-full bg-[var(--brand-accent)] px-1 text-center text-[11px] font-bold leading-5 text-neutral-900">
                    {heldBills.length}
                  </span>
                ) : null}
              </button>
              <button type="button" onClick={handlePrint} className="pos-tap flex h-14 items-center justify-center rounded-lg bg-[var(--brand-accent)] text-neutral-900" aria-label="Print">
                <Printer className="h-6 w-6" />
              </button>
              <button type="button" disabled={!canSaleView} onClick={() => setHistoryOpen(true)} className="pos-tap flex h-14 items-center justify-center rounded-lg bg-[var(--brand-primary-dark)] text-white disabled:opacity-35" aria-label="History">
                <History className="h-6 w-6" />
              </button>
            </div>
          </div>
        </section>

        {/* ── RIGHT: Catalog ── */}
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--pos-catalog-surface)] p-3">

          {/* Search */}
          <div className="relative z-[91] mb-3">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--neutral-400)]" />
            <input type="text" placeholder="Search item name or code" value={search}
              ref={searchInputRef}
              readOnly
              inputMode="none"
              onFocus={(e) => { e.currentTarget.blur(); setSearchKbOpen(true) }}
              onClick={() => setSearchKbOpen(true)}
              className="w-full rounded-xl border border-[var(--border)] bg-white py-3 pl-11 pr-10 text-[var(--foreground)] placeholder:text-[var(--neutral-400)] shadow-sm focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
              autoComplete="off" />
            {search.trim() ? (
              <button type="button" className="absolute right-3 top-1/2 z-[92] -translate-y-1/2 rounded-lg p-1.5 text-[var(--neutral-400)] hover:text-[var(--foreground)]" onClick={() => { setSearch(''); setSearchKbOpen(false) }} aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            ) : null}
            {search.trim() ? (
              <ul className="absolute left-0 right-0 top-full z-[93] mt-1 max-h-56 overflow-auto rounded-xl border border-[var(--border)] bg-white shadow-xl">
                {searchHits.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-[var(--neutral-400)]">No matching items.</li>
                ) : (
                  searchHits.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--neutral-50)]"
                        onPointerDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleProductTap(p)
                        }}
                      >
                        <span className="font-mono text-xs text-[var(--neutral-400)]">{p.code}</span>
                        <span className="ml-2 font-medium text-[var(--foreground)]">{p.name}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>

          <div className="mb-3 min-w-0">
            <div className="flex min-w-0 items-start gap-1.5">
              <button
                type="button"
                disabled={catsExpanded}
                onClick={() => scrollCategoryStrip(-1)}
                className="pos-tap pos-category-nav pos-category-nav--arrow shrink-0 items-center justify-center rounded-lg bg-[var(--brand-primary)] text-white disabled:opacity-35"
                aria-label="Previous categories"
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
              {catsExpanded ? (
                <div className="pos-category-expand-scroll pos-scroll-visible min-w-0 flex-1">
                  <div
                    className="grid gap-2.5"
                    style={{
                      gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 9.5rem), 1fr))',
                    }}
                  >
                    {catRow.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCategory(c.id)}
                        className={`pos-category-btn flex min-w-0 items-center justify-center rounded-xl px-3 text-center text-base font-bold leading-snug shadow-md ${c.colour} ${
                          categoryId === c.id ? 'ring-2 ring-[var(--brand-accent)] ring-offset-2' : ''
                        }`}
                      >
                        <span className="line-clamp-2 break-words">{c.name.replace('★ ', '')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  ref={catScrollRef}
                  className="pos-category-strip pos-scroll-x min-w-0 flex-1"
                >
                  <div className="pos-category-strip-inner pb-1">
                    {catRow.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCategory(c.id)}
                        className={`pos-category-btn flex min-w-0 items-center justify-center rounded-xl px-3 text-center text-base font-bold leading-snug shadow-md ${c.colour} ${
                          categoryId === c.id ? 'ring-2 ring-[var(--brand-accent)] ring-offset-2' : ''
                        }`}
                      >
                        <span className="line-clamp-2 break-words">{c.name.replace('★ ', '')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button
                type="button"
                disabled={catsExpanded}
                onClick={() => scrollCategoryStrip(1)}
                className="pos-tap pos-category-nav pos-category-nav--arrow shrink-0 items-center justify-center rounded-lg bg-[var(--brand-primary)] text-white disabled:opacity-35"
                aria-label="Next categories"
              >
                <ChevronRight className="h-6 w-6" aria-hidden />
              </button>
              <button
                type="button"
                className="pos-tap pos-category-nav shrink-0 items-center justify-center rounded-lg bg-[var(--brand-primary)] text-white"
                onClick={() => setCatsExpanded((open) => !open)}
                aria-label={catsExpanded ? 'Collapse categories' : 'Show all categories'}
                aria-expanded={catsExpanded}
              >
                {catsExpanded ? <ChevronUp className="h-6 w-6" /> : <ChevronDown className="h-6 w-6" />}
              </button>
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="pos-tap flex h-8 w-8 items-center justify-center rounded-md bg-[var(--brand-primary)] text-white"
              onClick={() => catalogScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
              aria-label="Back to top"
            >
              <Check className="h-4 w-4" />
            </button>
            <button type="button" className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-medium"
              onClick={() => catalogScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}>
              <ChevronUp className="h-3.5 w-3.5" /> Top
            </button>
          </div>

          <div
            ref={catalogScrollRef}
            className="pos-scroll-visible pos-scroll-visible--inverse pos-product-grid grid min-h-0 min-w-0 w-full flex-1 overflow-x-hidden p-0.5"
            style={{
              ['--pos-tile-min' as string]: `${Math.round(POS_TILE_BASE_PX * (productTilePercent / 100))}px`,
              ['--pos-tile-font' as string]: `${(0.95 * (productTilePercent / 100)).toFixed(3)}rem`,
              ['--pos-tile-gap' as string]: `${Math.max(0.45, 0.65 * (productTilePercent / 100)).toFixed(2)}rem`,
            }}
          >
            {filteredProducts.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] px-6 py-16 text-center">
                <p className="text-sm font-semibold text-[var(--neutral-500)]">No products match</p>
              </div>
            ) : (
              filteredProducts.map((p) => (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleProductTap(p) } }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return
                    handleProductLongPressStart(p)
                  }}
                  onPointerUp={(e) => {
                    if (e.button !== 0) return
                    handleProductLongPressEnd(p)
                  }}
                  onPointerLeave={() => {
                    if (longPressTimerRef.current) {
                      clearTimeout(longPressTimerRef.current)
                      longPressTimerRef.current = null
                    }
                  }}
                  onPointerCancel={() => {
                    if (longPressTimerRef.current) {
                      clearTimeout(longPressTimerRef.current)
                      longPressTimerRef.current = null
                    }
                  }}
                  className="product-tile group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-[var(--pos-product-tile-border)] bg-[var(--pos-product-tile)] p-3 text-center text-stone-900 shadow-md hover:border-[var(--brand-primary)]"
                >
                  <button
                    type="button"
                    className="absolute left-1 top-1 flex h-7 w-7 items-center justify-center rounded-md text-[var(--brand-accent-dark)]"
                    onClick={(e) => { e.stopPropagation(); toggleFav(p.id) }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                    aria-label={isFav(p.id) ? 'Remove from favourites' : 'Add to favourites'}
                  >
                    <Star className={`h-4 w-4 ${isFav(p.id) ? 'fill-[var(--brand-accent)] text-[var(--brand-accent-dark)]' : ''}`} />
                  </button>
                  {lines.find((l) => l.productId === p.id) ? (
                    <span className="absolute right-1 top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--brand-primary)] px-1 text-[11px] font-bold text-white">
                      {lines.find((l) => l.productId === p.id)?.qty}
                    </span>
                  ) : null}
                  <h3 className="line-clamp-3 px-1 font-semibold leading-tight">
                    {p.name}
                  </h3>
                  <span className="product-tile-price mt-1.5 font-bold tabular-nums">
                    Rs {p.unitPrice.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
      {!outletId ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--pos-catalog-surface)]/80 p-6 backdrop-blur-[2px]">
          <div className="max-w-md rounded-2xl border border-[var(--border)] bg-white p-6 text-center shadow-xl">
            <p className="font-pos-title text-lg font-bold text-[var(--foreground)]">Showroom not connected</p>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              This desktop till must have a POS Verification Code to connect to a showroom.
              Press <span className="font-semibold text-[var(--foreground)]">Ctrl+Shift+A</span>, unlock with the admin key, then save the code from DMS.
            </p>
          </div>
        </div>
      ) : null}
      </div>

      {/* ── Modals ── */}
      {confirmShutdown ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-white p-6 text-center shadow-2xl">
            <p className="font-pos-title text-xl font-bold text-[var(--foreground)]">Shutdown this device?</p>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Yes will power off this computer now. The POS app will not close by itself.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={shuttingDown}
                className="pos-tap rounded-xl bg-[var(--brand-primary)] py-3 text-base font-bold text-white disabled:opacity-50"
                onClick={() => void confirmDeviceShutdown()}
              >
                {shuttingDown ? 'Shutting down…' : 'Yes'}
              </button>
              <button
                type="button"
                disabled={shuttingDown}
                className="pos-tap rounded-xl border border-[var(--border)] py-3 text-base font-semibold text-[var(--foreground)] disabled:opacity-50"
                onClick={() => setConfirmShutdown(false)}
              >
                No
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {heldListOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <h3 className="font-pos-title text-xl font-bold">Held bills</h3>
              <button type="button" className="rounded-lg p-1.5 text-[var(--muted-foreground)]" onClick={() => { setHeldListOpen(false); setRecallConfirmId(null) }} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3">
              {heldBills.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-[var(--muted-foreground)]">No held bills.</p>
              ) : (
                <ul className="space-y-2">
                  {heldBills.map((b) => (
                    <li key={b.id} className="rounded-xl border border-[var(--border)] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold tabular-nums">Rs {b.total.toFixed(2)}</p>
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {b.lines.length} item{b.lines.length === 1 ? '' : 's'} · {new Date(b.heldAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {b.cashierName ? ` · ${b.cashierName}` : ''}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-[var(--foreground)]">
                            {b.lines.map((l) => `${l.name} ×${l.qty}`).join(', ')}
                          </p>
                        </div>
                        <button type="button" className="rounded-lg p-2 text-[var(--brand-primary)]" onClick={() => removeHeldBill(b.id)} aria-label="Delete held bill">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="mt-3 w-full rounded-lg bg-[var(--brand-primary)] py-2.5 text-sm font-bold text-white"
                        onClick={() => handleRecallBill(b.id)}
                      >
                        Recall
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {recallConfirmId ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-white p-6 text-center shadow-2xl">
            <p className="font-pos-title text-xl font-bold text-[var(--foreground)]">Replace current bill?</p>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">The open bill will be held first, then the selected held bill will load.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                className="pos-tap rounded-xl bg-[var(--brand-primary)] py-3 text-base font-bold text-white"
                onClick={() => {
                  if (outletId && lines.length > 0) {
                    holdBill({ outletId, cashierName, lines })
                  }
                  applyRecall(recallConfirmId)
                }}
              >
                Yes
              </button>
              <button
                type="button"
                className="pos-tap rounded-xl border border-[var(--border)] py-3 text-base font-semibold text-[var(--foreground)]"
                onClick={() => setRecallConfirmId(null)}
              >
                No
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {confirmClear ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-white p-6 text-center shadow-2xl">
            <p className="font-pos-title text-xl font-bold text-[var(--foreground)]">Clear this bill?</p>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">All items will be removed. This cannot be undone.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                className="pos-tap rounded-xl bg-[var(--brand-primary)] py-3 text-base font-bold text-white"
                onClick={() => {
                  setNumpad(null)
                  clear()
                  setConfirmClear(false)
                }}
              >
                Yes
              </button>
              <button
                type="button"
                className="pos-tap rounded-xl border border-[var(--border)] py-3 text-base font-semibold text-[var(--foreground)]"
                onClick={() => setConfirmClear(false)}
              >
                No
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} onPay={handlePay} total={sub} />
      {postSale ? (
        <PostSalePopups
          state={postSale}
          onDone={() => setPostSale(null)}
          onBrowserPreview={(opts) => setPreviewOpts(opts)}
        />
      ) : null}
      {previewOpts && !isElectronPos() ? (
        <PrintPreviewModal opts={previewOpts} onClose={() => setPreviewOpts(null)} />
      ) : null}
      <TransactionHistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} outletId={outletId} outletLabel={outletLabel} />
      {numpad ? (
        <QtyNumpad
          productName={numpad.name}
          initialQty={numpad.currentQty > 0 ? numpad.currentQty : 1}
          onConfirm={confirmNumpad}
          onCancel={() => setNumpad(null)}
        />
      ) : null}
      {diagnosticOpen ? (
        <DiagnosticPage onClose={() => { setDiagnosticOpen(false); void loadData() }} />
      ) : null}
      {searchKbOpen ? (
        <SearchKeyboard
          value={search}
          onChange={setSearch}
          onClose={() => setSearchKbOpen(false)}
          onEnter={() => {
            const first = filteredProducts[0]
            if (first) handleProductTap(first)
          }}
          forItemCode
        />
      ) : null}

      {/* ── Operations drawer (slides from left) ── */}
      {drawer ? (
        <div className="fixed inset-0 z-40 flex">
          <aside className="flex h-full w-72 max-w-[85vw] min-h-0 flex-col border-r border-[var(--border)] bg-white shadow-2xl">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--brand-primary)] px-4 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">Menu</p>
                <span className="font-pos-title text-lg font-bold text-white">Operations</span>
              </div>
              <button type="button" onClick={() => setDrawer(false)} className="pos-tap rounded-lg p-2 text-white/80 hover:bg-white/10" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="pos-scroll-visible min-h-0 flex-1">
            <nav className="flex flex-col gap-1.5 p-3">
              <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Daily tasks</p>
              {canStockBfCreate || canStockBfView ? (
                <OpBtn icon={<Package className="h-5 w-5" />} label="Stock BF" hint="Enter opening stock for today" onClick={() => { onOpenScreen('stock-bf'); setDrawer(false) }} />
              ) : null}
              {canTransferCreate ? (
                <OpBtn icon={<Truck className="h-5 w-5" />} label="New Transfer" hint="Send stock to another showroom" onClick={() => { onOpenScreen('transfer'); setDrawer(false) }} />
              ) : null}
              {canTransferView ? (
                <OpBtn icon={<Inbox className="h-5 w-5" />} label="Pending Transfers" hint="Confirm goods arriving here" onClick={() => { onOpenScreen('transfers'); setDrawer(false) }} />
              ) : null}
              {canDeliveryReturnCreate ? (
                <OpBtn icon={<Undo2 className="h-5 w-5" />} label="Delivery Return" hint="Return items to warehouse" onClick={() => { onOpenScreen('return'); setDrawer(false) }} />
              ) : null}
              {canCashierBalanceView || canCashierBalanceEdit ? (
                <OpBtn icon={<Wallet className="h-5 w-5" />} label="Cash Submission" hint="Day-end cashier totals" onClick={() => { onOpenScreen('cash'); setDrawer(false) }} />
              ) : null}
              {canSaleRecordsView ? (
                <OpBtn icon={<Bell className="h-5 w-5" />} label="Sale Records" hint="Showroom vs system difference" onClick={() => { onOpenScreen('sale-records'); setDrawer(false) }} />
              ) : null}

              <p className="mt-3 px-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">Till</p>
              <div className="rounded-xl border border-[var(--border)] px-3 py-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-[var(--foreground)]">Receipt phone (printed footer)</span>
                  <input
                    readOnly
                    value={receiptCompanyPhone}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--neutral-50)] px-3 py-2 text-sm text-[var(--foreground)]"
                  />
                </label>
                <label className="mt-3 block">
                  <span className="mb-1 block text-[11px] font-semibold text-[var(--foreground)]">Receipt address line</span>
                  <textarea
                    readOnly
                    rows={2}
                    value={receiptCompanyAddress}
                    className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--neutral-50)] px-3 py-2 text-sm text-[var(--foreground)]"
                  />
                </label>
              </div>
            </nav>
            </div>
          </aside>
          <button type="button" className="flex-1 bg-black/50" aria-label="Close menu" onClick={() => setDrawer(false)} />
        </div>
      ) : null}
    </div>
  )
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function MenuAction({ icon, label, onClick, textClass = 'text-[var(--foreground)]' }: { icon: ReactNode; label: string; onClick: () => void; textClass?: string }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-[var(--neutral-50)] ${textClass}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function OpBtn({ icon, label, hint, onClick }: { icon: ReactNode; label: string; hint?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex w-full items-start gap-3 rounded-xl border border-[var(--border)] px-3 py-3 text-left transition hover:border-[var(--brand-primary)]/40 hover:bg-[var(--neutral-50)]">
      <span className="mt-0.5 flex-shrink-0 text-[var(--brand-primary)]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--foreground)]">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">{hint}</span> : null}
      </span>
    </button>
  )
}
