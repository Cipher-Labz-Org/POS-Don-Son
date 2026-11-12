import { create } from 'zustand'
import type { CartLine } from './types'

interface CartState {
  lines: CartLine[]
  add: (p: { productId: string; code: string; name: string; unitPrice: number; qty?: number }) => void
  inc: (productId: string) => void
  dec: (productId: string) => void
  remove: (productId: string) => void
  clear: () => void
  setLines: (lines: CartLine[]) => void
  applyCatalogPrices: (products: { productId: string; unitPrice: number }[]) => void
  subtotal: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],

  add: (p) =>
    set((s) => {
      const existing = s.lines.find((l) => l.productId === p.productId)
      const addQty = p.qty ?? 1
      if (existing) {
        return {
          lines: s.lines.map((l) =>
            l.productId === p.productId ? { ...l, qty: l.qty + addQty } : l,
          ),
        }
      }
      return {
        lines: [
          ...s.lines,
          {
            productId: p.productId,
            code: p.code,
            name: p.name,
            unitPrice: p.unitPrice,
            qty: addQty,
          },
        ],
      }
    }),

  inc: (productId) =>
    set((s) => ({
      lines: s.lines.map((l) =>
        l.productId === productId ? { ...l, qty: l.qty + 1 } : l,
      ),
    })),

  dec: (productId) =>
    set((s) => ({
      lines: s.lines
        .map((l) =>
          l.productId === productId ? { ...l, qty: l.qty - 1 } : l,
        )
        .filter((l) => l.qty > 0),
    })),

  remove: (productId) =>
    set((s) => ({
      lines: s.lines.filter((l) => l.productId !== productId),
    })),

  clear: () => set({ lines: [] }),

  setLines: (lines) => set({ lines: lines.map((l) => ({ ...l })) }),

  applyCatalogPrices: (products) =>
    set((s) => {
      const priceById = new Map(products.map((p) => [p.productId, p.unitPrice]))
      return {
        lines: s.lines.map((l) => {
          const next = priceById.get(l.productId)
          return next == null || next === l.unitPrice ? l : { ...l, unitPrice: next }
        }),
      }
    }),

  subtotal: () => {
    const lines = get().lines
    return lines.reduce((acc, l) => acc + l.unitPrice * l.qty, 0)
  },
}))
