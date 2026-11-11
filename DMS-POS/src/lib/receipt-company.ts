/** Same printed address for every showroom. */
export const RECEIPT_COMPANY_ADDRESS = 'NO: 302/D, OLD KANDY ROAD,\nDALUGAMA, KELANIYA'

/** Company name printed on sale receipts. */
export const RECEIPT_COMPANY_NAME = 'Don & Sons (Pvt) Ltd'

/** Normal-weight line above THANK YOU. */
export const RECEIPT_FOOD_POLICY =
  'FOOD ARE NOT RETURNABLE COMPLAINT MUST BE LODGED BEFORE 12 NOON NEXT DAY.'

/** Head-office contact shown on every receipt. */
export const RECEIPT_HQ_PHONE = '0112 911 412'

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/** HQ number plus the Phone Number from the DMS Showroom module. */
export function formatReceiptContact(showroomPhone?: string | null): string {
  const local = (showroomPhone ?? '').trim()
  if (!local) return RECEIPT_HQ_PHONE
  if (digitsOnly(local) === digitsOnly(RECEIPT_HQ_PHONE)) return RECEIPT_HQ_PHONE
  return `${RECEIPT_HQ_PHONE} / ${local}`
}

/** Local showroom number only (for bill body under Showroom name). */
export function formatShowroomBillPhone(showroomPhone?: string | null): string {
  return (showroomPhone ?? '').trim()
}
