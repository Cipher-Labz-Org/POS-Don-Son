import { THERMAL_SLIP_CSS, THERMAL_WIDTH_PX } from './thermal-slip'

export type PrintReceiptOpts = {
  title: string
  companyAddress?: string
  companyPhone?: string
  outletLabel: string
  /** Showroom local number (DMS Showrooms → Phone), printed under Showroom line. */
  showroomPhone?: string
  lines: { name: string; unitPrice: number; qty: number; amount: number }[]
  total: number
  cash: number
  change: number
  paymentMethod?: string
  saleNo?: string
  cashier?: string
  dateTime?: string
  /** Extra lines above the default thank-you footer (e.g. returns policy) */
  footerLines?: string[]
}

/** Label under TOTAL: Cash or Card. */
export function receiptPaidLabel(paymentMethod?: string | null): string {
  const method = (paymentMethod ?? '').trim().toLowerCase()
  return method.includes('card') ? 'Card' : 'Cash'
}

/** Full HTML document for the receipt (no inline print script — caller triggers print). */
function buildReceiptDocumentHtml(opts: PrintReceiptOpts): string {
  const rows = opts.lines
    .map(
      (l) =>
        `<tr>
          <td class="item">${escapeHtml(l.name)}</td>
          <td class="each">${Number(l.unitPrice).toFixed(2)}</td>
          <td class="qty">${Number(l.qty)}</td>
          <td class="tot">${Number(l.amount).toFixed(2)}</td>
        </tr>`,
    )
    .join('')

  const totalItems = opts.lines.length
  const totalQty = opts.lines.reduce((sum, l) => sum + Number(l.qty || 0), 0)

  const extraFooter = (opts.footerLines ?? [])
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<div class="policy">${escapeHtml(l)}</div>`)
    .join('')

  const paidLabel = receiptPaidLabel(opts.paymentMethod)

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt</title>
<style>
${THERMAL_SLIP_CSS}
body{
  font-family:Arial,Helvetica,'Segoe UI',sans-serif;
  font-weight:400;
  color:#000;
  font-size:13px;
  line-height:1.4;
}
.header{text-align:center;margin-bottom:6px}
.company-name{font-size:16px;font-weight:800;margin:2px 0;letter-spacing:0}
.company-info{font-size:12px;font-weight:400;margin:2px 0;line-height:1.35;text-align:center;white-space:normal;overflow-wrap:anywhere}
.divider{border-top:2px dashed #000;margin:6px 0}
.info-line{font-size:12px;font-weight:400;margin:3px 0}
table{font-size:12px;margin:6px 0}
th{padding:4px 2px;font-weight:700;border-bottom:2px dashed #000;vertical-align:bottom;font-size:11px}
td{padding:4px 1px;vertical-align:top;font-weight:400;font-size:12px}
.item{text-align:left;white-space:normal;padding-right:2px}
.each{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;padding-right:2px}
.qty{text-align:center;white-space:nowrap;font-variant-numeric:tabular-nums;padding-right:2px}
.tot{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.totals{margin-top:6px;padding-top:4px}
.total-row{display:flex;justify-content:space-between;gap:8px;margin:5px 0;font-size:13px;font-weight:400}
.total-row span:last-child{font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right}
.total-row.main{font-size:15px;font-weight:800}
.item-count{font-size:12px;font-weight:400;margin:7px 0;text-align:left}
.policy{text-align:center;font-size:11px;font-weight:400;line-height:1.35;margin:6px 0;text-transform:none;overflow-wrap:anywhere}
.thank-you{display:block;width:100%;text-align:center;font-weight:800;font-size:14px;margin:8px 0 0;letter-spacing:0.04em}
</style></head><body>
<div class="slip cols-4">
<div class="header">
  <div class="company-name">${escapeHtml(opts.title)}</div>
  ${opts.companyAddress ? `<div class="company-info">${escapeHtml(opts.companyAddress).replace(/\n/g, '<br>')}</div>` : ''}
  ${opts.companyPhone ? `<div class="company-info">${escapeHtml(opts.companyPhone)}</div>` : ''}
</div>
<div class="divider"></div>
<div class="info-line">Showroom : ${escapeHtml(opts.outletLabel)}</div>
${opts.showroomPhone ? `<div class="info-line">Tel : ${escapeHtml(opts.showroomPhone)}</div>` : ''}
${opts.dateTime ? `<div class="info-line">Date: ${escapeHtml(opts.dateTime)}</div>` : ''}
${opts.cashier ? `<div class="info-line">Cashier: ${escapeHtml(opts.cashier)}</div>` : ''}
${opts.saleNo ? `<div class="info-line">Bill No: ${escapeHtml(opts.saleNo)}</div>` : ''}
<div class="divider"></div>
<table>
  <colgroup>
    <col>
    <col style="width:15mm">
    <col style="width:8mm">
    <col style="width:16mm">
  </colgroup>
  <thead>
    <tr>
      <th class="item">Item</th>
      <th class="each">Each</th>
      <th class="qty">Qty</th>
      <th class="tot">Total</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<div class="divider"></div>
<div class="totals">
  <div class="total-row main">
    <span>TOTAL</span>
    <span>${Number(opts.total).toFixed(2)}</span>
  </div>
  <div class="total-row">
    <span>${escapeHtml(paidLabel)}</span>
    <span>${Number(opts.cash).toFixed(2)}</span>
  </div>
  <div class="total-row">
    <span>CHANGE</span>
    <span>${Number(opts.change).toFixed(2)}</span>
  </div>
</div>
<div class="divider"></div>
<div class="item-count">No of Items : ${totalItems}  Total Qty : ${totalQty}</div>
<div class="divider"></div>
${extraFooter}
<div class="thank-you">THANK YOU!</div>
</div>
</body></html>`
}

function printViaIframe(html: string): Promise<boolean> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText =
      `position:fixed;left:-10000px;top:0;width:${THERMAL_WIDTH_PX}px;height:1200px;border:0;opacity:0;pointer-events:none`
    document.body.appendChild(iframe)

    const win = iframe.contentWindow
    const doc = iframe.contentDocument
    if (!win || !doc) {
      iframe.remove()
      resolve(false)
      return
    }

    doc.open()
    doc.write(html)
    doc.close()

    const cleanup = () => {
      iframe.remove()
    }

    let leakGuard: ReturnType<typeof setTimeout> | undefined
    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      if (leakGuard) clearTimeout(leakGuard)
      cleanup()
      resolve(ok)
    }

    const printNow = () => {
      try {
        win.focus()
        win.print()
        // Dialog opened — treat as success (cancel is still a successful open)
        finish(true)
      } catch {
        finish(false)
      }
    }

    win.addEventListener(
      'afterprint',
      () => {
        if (leakGuard) clearTimeout(leakGuard)
        cleanup()
      },
      { once: true },
    )

    leakGuard = setTimeout(() => {
      leakGuard = undefined
      cleanup()
    }, 120_000)

    const schedulePrint = () => setTimeout(printNow, 50)

    if (doc.readyState === 'complete') {
      schedulePrint()
    } else {
      win.addEventListener('load', schedulePrint, { once: true })
    }
  })
}

/**
 * Prints a receipt: Electron sends silently to the default printer;
 * browser mode falls back to the system print dialog.
 */
/** Desktop POS client (Electron). Browser/sample UI is everything else. */
export function isElectronPos() {
  return typeof window !== 'undefined' && window.dmsPos?.mode === 'electron'
}

async function printHtmlJob(html: string, label: string): Promise<void> {
  if (isElectronPos() && window.dmsPos?.printSilent) {
    try {
      const result = await window.dmsPos.printSilent(html)
      if (result?.success) return
      console.warn(`[PRINT] ${label} silent print failed:`, result?.error)
    } catch (error) {
      console.warn(`[PRINT] ${label} silent print exception:`, error)
    }
  }
  await printViaIframe(html)
}

/** ORIGINAL slip, wait for cutter, then COPY slip. */
export async function printOriginalThenCopy(originalHtml: string, copyHtml: string): Promise<void> {
  await printHtmlJob(originalHtml, 'ORIGINAL')
  await new Promise((r) => setTimeout(r, 3500))
  await printHtmlJob(copyHtml, 'COPY')
}

/** COPY slip first, wait for cutter, then ORIGINAL slip. */
export async function printCopyThenOriginal(originalHtml: string, copyHtml: string): Promise<void> {
  await printHtmlJob(copyHtml, 'COPY')
  await new Promise((r) => setTimeout(r, 3500))
  await printHtmlJob(originalHtml, 'ORIGINAL')
}

export async function printReceiptHtml(
  opts: PrintReceiptOpts,
  flags?: { silentOnly?: boolean },
): Promise<boolean> {
  const html = buildReceiptDocumentHtml(opts)

  if (isElectronPos() && window.dmsPos?.printSilent) {
    try {
      const result = await window.dmsPos.printSilent(html)
      if (result?.success) return true
      console.warn('[PRINT] Silent print failed:', result?.error)
    } catch (error) {
      console.warn('[PRINT] Silent print exception:', error)
    }
    return false
  }

  if (flags?.silentOnly) return false
  return printViaIframe(html)
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
