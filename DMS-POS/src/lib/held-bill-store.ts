import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CartLine } from './types'

export type HeldBill = {
  id: string
  outletId: string
  cashierName: string
  heldAt: number
  lines: CartLine[]
  total: number
}

const MAX_HELD = 20

interface HeldBillState {
  bills: HeldBill[]
  hold: (input: { outletId: string; cashierName: string; lines: CartLine[] }) => HeldBill | null
  recall: (id: string) => HeldBill | undefined
  remove: (id: string) => void
  forOutlet: (outletId: string) => HeldBill[]
}

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `hold-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const useHeldBillStore = create<HeldBillState>()(
  persist(
    (set, get) => ({
      bills: [],

      hold: ({ outletId, cashierName, lines }) => {
        if (lines.length === 0) return null
        const bill: HeldBill = {
          id: newId(),
          outletId,
          cashierName,
          heldAt: Date.now(),
          lines: lines.map((l) => ({ ...l })),
          total: lines.reduce((acc, l) => acc + l.unitPrice * l.qty, 0),
        }
        set((s) => {
          const others = s.bills.filter((b) => b.outletId === outletId)
          const rest = s.bills.filter((b) => b.outletId !== outletId)
          const nextForOutlet = [bill, ...others].slice(0, MAX_HELD)
          return { bills: [...nextForOutlet, ...rest] }
        })
        return bill
      },

      recall: (id) => {
        const bill = get().bills.find((b) => b.id === id)
        if (!bill) return undefined
        set((s) => ({ bills: s.bills.filter((b) => b.id !== id) }))
        return bill
      },

      remove: (id) => set((s) => ({ bills: s.bills.filter((b) => b.id !== id) })),

      forOutlet: (outletId) =>
        get()
          .bills.filter((b) => b.outletId === outletId)
          .sort((a, b) => b.heldAt - a.heldAt),
    }),
    { name: 'dms-pos-held-bills', storage: createJSONStorage(() => localStorage) },
  ),
)
