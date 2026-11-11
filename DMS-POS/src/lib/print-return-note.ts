import { printCopyThenOriginal } from './print-receipt'
import { extraLineFeedsHtml, operationNoteSignatureFooterHtml, THERMAL_SLIP_CSS } from './thermal-slip'

export type ReturnNoteLine = {
  code: string
  name: string
  qty: number
}

export type ReturnNoteOpts = {
  returnNo: string
  submittedAt: string
  showroom: string
  submittedBy: string
  comment?: string
  reason?: string
  lines: ReturnNoteLine[]
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatQty(qty: number): string {
  return Number(qty).toFixed(2)
}

/** Match sample: Sep 07, 2026 04:09:49 PM */
function formatDateTime(value: string): string {
  const parsed = new Date(value)
  const d = Number.isNaN(parsed.getTime()) ? new Date() : parsed
  const formatted = d.toLocaleString('en-US', {
    timeZone: 'Asia/Colombo',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
  return formatted.replace(',', '')
}

function commentText(opts: ReturnNoteOpts): string {
  const t = (opts.comment ?? opts.reason ?? '').trim()
  return t || '-'
}

function buildReturnNoteHtml(opts: ReturnNoteOpts, variant: 'original' | 'copy'): string {
  const stamp = variant === 'original' ? 'RETURN ORIGINAL' : 'RETURN COPY'
  const rows = opts.lines
    .map(
      (l) =>
        `<tr>
          <td class="code">${escapeHtml(l.code)}</td>
          <td class="item">${escapeHtml(l.name)}</td>
          <td class="qty">${formatQty(l.qty)}</td>
        </tr>`,
    )
    .join('')

  const footer = operationNoteSignatureFooterHtml(opts.submittedBy, variant)

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${stamp}</title>
<style>
${THERMAL_SLIP_CSS}
body{
  font-family:'Times New Roman',Times,Georgia,serif;
  font-weight:400;
  color:#000;
  font-size:12px;
  line-height:1.35;
}
.title{text-align:center;font-size:18px;font-weight:700;margin:2px 0 8px}
.stamp{text-align:center;font-size:14px;font-weight:700;letter-spacing:0.03em;margin:8px 0 6px}
.meta{font-size:12px;font-weight:400;margin:2px 0;overflow-wrap:anywhere}
table{font-size:11px;margin:4px 0 10px}
th,td{border:1px solid #000;padding:3px 2px;vertical-align:top}
th{font-weight:700;text-align:center}
td{font-weight:400}
td.code,th.code{text-align:left;white-space:nowrap}
td.item,th.item{text-align:left;white-space:normal}
td.qty,th.qty{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.sig-section{margin-top:8px}
.sig-k{margin-bottom:1mm;font-weight:700}
.cut-feed{height:8mm}
</style></head><body>
<div class="slip cols-3">
<div class="title">Return Note</div>
<div class="meta">Return No : ${escapeHtml(opts.returnNo)}</div>
<div class="meta">Showroom : ${escapeHtml(opts.showroom)}</div>
<div class="meta">Date &amp; Time : ${escapeHtml(formatDateTime(opts.submittedAt))}</div>
<div class="meta">Comment : ${escapeHtml(commentText(opts))}</div>
<div class="stamp">${stamp}</div>
<table>
  <colgroup>
    <col style="width:16mm">
    <col>
    <col style="width:12mm">
  </colgroup>
  <thead>
    <tr>
      <th class="code">CODE</th>
      <th class="item">ITEM</th>
      <th class="qty">QTY</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
${footer}
${extraLineFeedsHtml(2)}
</div>
</body></html>`
}

/** Prints RETURN COPY first, waits for the cutter, then prints RETURN ORIGINAL. */
export async function printReturnNotes(opts: ReturnNoteOpts): Promise<void> {
  await printCopyThenOriginal(
    buildReturnNoteHtml(opts, 'original'),
    buildReturnNoteHtml(opts, 'copy'),
  )
}
