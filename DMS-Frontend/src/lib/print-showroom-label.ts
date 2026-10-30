/** Fixed showroom label size (thermal / sticker). */
export const SHOWROOM_LABEL_WIDTH_MM = 40;
export const SHOWROOM_LABEL_HEIGHT_MM = 17;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildShowroomLabelPrintHtml(showroomCode: string, labelCount: number): string {
  const text = escapeHtml(showroomCode.trim());
  const count = Math.max(1, Math.min(1000, Math.floor(labelCount)));
  const pages = Array.from({ length: count }, () =>
    `<section class="sl-label"><div class="sl-label-text">${text}</div></section>`,
  ).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<title>Showroom label</title>
<style>
  @page {
    size: ${SHOWROOM_LABEL_WIDTH_MM}mm ${SHOWROOM_LABEL_HEIGHT_MM}mm;
    margin: 0;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${SHOWROOM_LABEL_WIDTH_MM}mm; }
  body { font-family: Arial, Helvetica, sans-serif; }
  .sl-label {
    width: ${SHOWROOM_LABEL_WIDTH_MM}mm;
    height: ${SHOWROOM_LABEL_HEIGHT_MM}mm;
    page-break-after: always;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 1mm 1.5mm;
  }
  .sl-label:last-child { page-break-after: auto; }
  .sl-label-text {
    width: 100%;
    text-align: center;
    font-weight: 700;
    font-size: 9pt;
    line-height: 1.1;
    word-break: break-word;
  }
  @media print {
    .sl-label { break-after: page; }
  }
</style>
</head><body>${pages}</body></html>`;
}

function printViaHiddenIframe(html: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Print showroom label');
    iframe.style.cssText =
      'position:fixed;left:-9999px;top:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    if (!win || !doc) {
      document.body.removeChild(iframe);
      resolve();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {
          /* ignore */
        }
      }, 500);
    };

    const run = () => {
      try {
        win.addEventListener('afterprint', finish, { once: true });
        setTimeout(finish, 120_000);
        win.focus();
        win.print();
      } catch {
        finish();
      }
    };

    if (doc.readyState === 'complete') run();
    else win.addEventListener('load', run, { once: true });
  });
}

export async function printShowroomLabels(showroomCode: string, labelCount: number): Promise<void> {
  const code = showroomCode?.trim();
  if (!code) throw new Error('Showroom code is required to print.');
  const html = buildShowroomLabelPrintHtml(code, labelCount);
  await printViaHiddenIframe(html);
}
