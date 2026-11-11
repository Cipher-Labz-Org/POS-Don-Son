import { printCopyThenOriginal } from './print-receipt'
import { extraLineFeedsHtml, operationNoteSignatureFooterHtml, THERMAL_SLIP_CSS } from './thermal-slip'
export type TransferNoteLine = {
  code: string
  name: string
  qty: number
}

export type TransferNoteOpts = {
  transferNo: string
  submittedAt: string
  fromShowroom: string
  toShowroom: string
  submittedBy: string
  comment?: string
  lines: TransferNoteLine[]
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

/** Match sample: Sep 07, 2026 03:05:12 PM */
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

function commentText(comment?: string): string {
  const t = (comment ?? '').trim()
  return t || '-'
}

function buildTransferNoteHtml(opts: TransferNoteOpts, variant: 'original' | 'copy'): string {
  const stamp = variant === 'original' ? 'TRANSFER ORIGINAL' : 'TRANSFER COPY'
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
<div class="title">Transfer Note</div>
<div class="meta">Transfer No : ${escapeHtml(opts.transferNo)}</div>
<div class="meta">Transfer From : ${escapeHtml(opts.fromShowroom)}</div>
<div class="meta">Date &amp; Time : ${escapeHtml(formatDateTime(opts.submittedAt))}</div>
<div class="meta">Transfer To : ${escapeHtml(opts.toShowroom)}</div>
<div class="meta">Comment : ${escapeHtml(commentText(opts.comment))}</div>
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

/** Prints TRANSFER COPY first, waits for the cutter, then prints TRANSFER ORIGINAL. */
export async function printTransferNotes(opts: TransferNoteOpts): Promise<void> {
  await printCopyThenOriginal(
    buildTransferNoteHtml(opts, 'original'),
    buildTransferNoteHtml(opts, 'copy'),
  )
}
