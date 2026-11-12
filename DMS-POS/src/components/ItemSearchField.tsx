import { useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ProductRow } from '../lib/types'
import { filterByCodeOrName } from '../lib/product-search'

type Props = {
  value: string
  onChange: (value: string) => void
  inputRef?: React.Ref<HTMLInputElement>
  open: boolean
  onOpenChange: (open: boolean) => void
  items: ProductRow[]
  onSelect: (product: ProductRow) => void
  onOpenKeyboard?: () => void
  disabled?: boolean
  placeholder?: string
}

/** Text shown in the item field after the user picks a product from the list. */
export function formatSelectedItemSearchLabel(p: Pick<ProductRow, 'code' | 'name'>): string {
  const code = p.code?.trim() ?? ''
  const name = p.name?.trim() ?? ''
  if (code && name) return `${code} ${name}`
  return code || name
}

export function filterItemChoices(
  products: ProductRow[],
  search: string,
  opts?: { posOnly?: boolean; requireOpenStockOnly?: boolean; limit?: number },
): ProductRow[] {
  let catalog = products
  if (opts?.posOnly) catalog = catalog.filter((p) => p.displayInPOS !== false)
  if (opts?.requireOpenStockOnly) catalog = catalog.filter((p) => p.requireOpenStock === true)
  return filterByCodeOrName(catalog, search, {
    limit: opts?.limit ?? 20,
    whenEmpty: 'all',
  })
}

export function ItemSearchField({
  value,
  onChange,
  inputRef,
  open,
  onOpenChange,
  items,
  onSelect,
  onOpenKeyboard,
  disabled = false,
  placeholder = 'Search item code or name',
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null
      if (!t) return
      if (rootRef.current?.contains(t)) return
      if (t.closest('[data-pos-osk]')) return
      onOpenChange(false)
    }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [open, onOpenChange])

  return (
    <div ref={rootRef} className="relative min-w-[220px] flex-1">
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Item</label>
      <div className="relative">
        <input
          ref={inputRef}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--neutral-50)] py-3 pl-4 pr-10 text-[var(--foreground)] placeholder:text-[var(--neutral-400)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 disabled:opacity-60"
          onChange={(e) => {
            onChange(e.target.value)
            onOpenChange(true)
          }}
          onFocus={() => {
            onOpenChange(true)
            onOpenKeyboard?.()
          }}
          onPointerDown={() => {
            onOpenChange(true)
            onOpenKeyboard?.()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              onOpenChange(false)
            }
            if (e.key === 'Enter' && value.trim() && items[0]) {
              e.preventDefault()
              onSelect(items[0])
              onOpenChange(false)
            }
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={open ? 'Hide item list' : 'Show item list'}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-40"
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const next = !open
            onOpenChange(next)
            if (next) onOpenKeyboard?.()
          }}
        >
          <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open ? (
        <ul className="pos-search-dropdown absolute left-0 right-0 bottom-full z-[90] mb-1 max-h-48 overflow-auto rounded-xl border border-[var(--border)] bg-white shadow-xl">
          {items.length === 0 ? (
            <li className="px-4 py-3 text-sm text-[var(--neutral-400)]">No matching items.</li>
          ) : (
            items.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--neutral-50)]"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onSelect(p)
                    onOpenChange(false)
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
  )
}
