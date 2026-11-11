/** 80mm thermal paper. Keep page size and content width the same. */
export const THERMAL_WIDTH_MM = 80
export const THERMAL_WIDTH_PX = Math.round((THERMAL_WIDTH_MM / 25.4) * 96)

/**
 * Shared 80mm slip for every POS bill: sale, Stock BF, transfer, return.
 * XP-80C clips ~12–16mm on the right of the roll. Keep the sheet 80mm and
 * inset the slip so Total / Qty / CASH / CHANGE stay on the printable area.
 */
export const THERMAL_SLIP_CSS = `
html,body{
  width:80mm;
  max-width:80mm;
  margin:0;
  padding:0;
  background:#fff;
  overflow-x:hidden!important;
  height:auto!important;
}
@media print {
  @page { margin: 0; size: 80mm auto; }
  html,body{width:80mm;max-width:80mm;margin:0;padding:0;overflow-x:hidden!important;height:auto!important}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
*{box-sizing:border-box;color:#000!important;-webkit-font-smoothing:none;font-smooth:never;text-rendering:geometricPrecision}
.slip{
  width:80mm;
  max-width:80mm;
  margin:0;
  padding:1mm 14mm 5mm 2.5mm;
  overflow-x:hidden;
}
.slip table{width:100%;max-width:100%;border-collapse:collapse;table-layout:fixed}
.slip th,.slip td{overflow-wrap:anywhere;word-wrap:break-word}
.slip tbody td{font-weight:400!important}
.slip .item{text-align:left;white-space:normal;padding-right:2px}
.slip .each,.slip .tot,.slip .qty{white-space:nowrap;font-variant-numeric:tabular-nums}
.slip .each,.slip .tot{text-align:right}
.slip .code{text-align:left;white-space:normal;overflow-wrap:anywhere}
.slip.cols-4 .item{width:auto}
.slip.cols-4 .each{width:15mm;padding-right:2px}
.slip.cols-4 .qty{width:8mm;text-align:center;padding-right:2px}
.slip.cols-4 .tot{width:16mm}
.slip.cols-3 .code{width:16mm}
.slip.cols-3 .item{width:auto;padding-right:3px}
.slip.cols-3 .qty{width:12mm;text-align:right}
.sig-field{width:100%;margin:1.5mm 0 1mm}
.sig-lf{
  display:block;
  margin:0;
  padding:0;
  border:0;
  font-family:'Courier New',Courier,monospace;
  font-size:16px;
  line-height:20px;
  min-height:20px;
  white-space:pre;
}
.sig-dots{
  border-bottom:1px dotted #000;
  width:100%;
  font-size:10px;
  line-height:4mm;
  height:4mm;
  margin:0;
}
.sig-cap{
  text-align:center;
  font-size:11px;
  margin:1.5mm 0 3mm;
}
`

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Printed line feed. Empty CSS / &lt;br&gt; / empty table cells are skipped by XP-80C. */
export function lineFeedHtml(): string {
  return `<div class="sig-lf">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>`
}

export function extraLineFeedsHtml(count = 2): string {
  return Array.from({ length: count }, () => lineFeedHtml()).join('')
}

/**
 * Signature write-gap. Two printed line feeds (~10mm), half the previous gap.
 */
export function signatureWriteFieldHtml(caption: string): string {
  return `<div class="sig-field">
  ${lineFeedHtml()}
  ${lineFeedHtml()}
  <div class="sig-dots">&nbsp;</div>
  <div class="sig-cap">${escapeHtml(caption)}</div>
</div>`
}

/**
 * Transfer / Delivery Return footer signatures.
 * COPY: sender keeps this slip — name + one signature line.
 * ORIGINAL: document that travels — sender + receiver name & signatures.
 */
export function operationNoteSignatureFooterHtml(
  submittedByName: string,
  variant: 'original' | 'copy',
): string {
  const name = escapeHtml(submittedByName)
  const submittedSignature = signatureWriteFieldHtml('Submitted By Signature')

  if (variant === 'copy') {
    return `<div class="meta">Submitted By : ${name}</div>
<div class="sig-section">${submittedSignature}</div>`
  }

  return `<div class="meta">Submitted By : ${name}</div>
<div class="sig-section">${submittedSignature}</div>
<div class="sig-section">
  <div class="sig-k">Received By :</div>
  ${signatureWriteFieldHtml('Received By Name')}
</div>
<div class="sig-section">
  ${signatureWriteFieldHtml('Received By Signature')}
</div>`
}
