import { Printer, X } from 'lucide-react'
import { printReceiptHtml, receiptPaidLabel, type PrintReceiptOpts } from '../lib/print-receipt'

type Props = {
  opts: PrintReceiptOpts
  onClose: () => void
}

export function PrintPreviewModal({ opts, onClose }: Props) {
  async function handlePrint() {
    const ok = await printReceiptHtml(opts)
    if (ok) onClose()
  }

  const totalItems = opts.lines.length
  const totalQty = opts.lines.reduce((sum, line) => sum + Number(line.qty || 0), 0)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Print Preview</h2>
            <p className="text-xs text-gray-500">Review before printing</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Receipt preview */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 p-4">
          <div className="mx-auto w-[80mm] max-w-full rounded-xl bg-white pl-[2.5mm] pr-[14mm] pt-[1mm] pb-[5mm] shadow text-[11px] font-normal">
            {/* Company header */}
            <div className="mb-1 text-center text-sm font-bold">
              {opts.title}
            </div>
            {opts.companyAddress && (
              <div className="mb-1 text-center text-[9px] font-normal leading-tight text-gray-600 whitespace-pre-line">
                {opts.companyAddress}
              </div>
            )}
            {opts.companyPhone && (
              <div className="mb-2 text-center text-[9px] font-normal text-gray-600">{opts.companyPhone}</div>
            )}

            <div className="my-2 border-t border-dashed border-gray-400" />

            {/* Transaction info */}
            <div className="mb-1 text-[10px] font-normal">Showroom : {opts.outletLabel}</div>
            {opts.showroomPhone ? (
              <div className="mb-1 text-[10px] font-normal">Tel : {opts.showroomPhone}</div>
            ) : null}
            {opts.dateTime && (
              <div className="mb-1 text-[10px] font-normal">Date: {opts.dateTime}</div>
            )}
            {opts.cashier && (
              <div className="mb-1 text-[10px] font-normal">Cashier: {opts.cashier}</div>
            )}
            {opts.saleNo && (
              <div className="mb-1 text-[10px] font-normal">Bill No: {opts.saleNo}</div>
            )}

            <div className="my-2 border-t border-dashed border-gray-400" />

            {/* Items table */}
            <table className="w-full table-fixed text-[10px]">
              <colgroup>
                <col className="w-[42%]" />
                <col className="w-[20%]" />
                <col className="w-[12%]" />
                <col className="w-[26%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-dashed border-gray-400">
                  <th className="pb-1 pr-2 text-left font-bold">Item</th>
                  <th className="pb-1 px-1 text-right font-bold whitespace-nowrap">Each</th>
                  <th className="pb-1 px-1 text-center font-bold whitespace-nowrap">Qty</th>
                  <th className="pb-1 pl-1 text-right font-bold whitespace-nowrap">Total</th>
                </tr>
              </thead>
              <tbody>
                {opts.lines.map((line, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-2 align-top break-words font-normal">{line.name}</td>
                    <td className="py-1 px-1 text-right align-top font-normal tabular-nums whitespace-nowrap">{line.unitPrice.toFixed(2)}</td>
                    <td className="py-1 px-1 text-center align-top font-normal tabular-nums whitespace-nowrap">{line.qty}</td>
                    <td className="py-1 pl-1 text-right align-top font-normal tabular-nums whitespace-nowrap">{line.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="my-2 border-t border-dashed border-gray-400" />

            {/* Totals */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span>TOTAL</span>
                <span>{opts.total.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span>{receiptPaidLabel(opts.paymentMethod)}</span>
                <span>{opts.cash.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span>CHANGE</span>
                <span>{opts.change.toFixed(2)}</span>
              </div>
            </div>

            <div className="my-2 border-t border-dashed border-gray-400" />

            {/* Item count */}
            <div className="text-[10px]">
              No of Items : {totalItems}  Total Qty : {totalQty}
            </div>

            <div className="my-2 border-t border-dashed border-gray-400" />

            {/* Footer message */}
            {(opts.footerLines ?? []).filter(Boolean).length > 0 && (
              <div className="space-y-0.5 text-center text-[10px] font-normal leading-tight text-gray-700">
                {(opts.footerLines ?? []).filter(Boolean).map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            )}

            {/* Thank you */}
            <div className="mt-3 text-center text-xs font-bold">THANK YOU!</div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-shrink-0 gap-3 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-bold text-white hover:bg-[var(--brand-primary-dark)]"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>
    </div>
  )
}
