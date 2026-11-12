import { fetchCategoriesPage, fetchProductsPage } from './api'
import { formatSubmitError } from './api-errors'
import { offlineDb, replaceOfflineCatalog } from './offline-db'
import { useSettingsStore } from './settings-store'
import type { CategoryRow, ProductRow } from './types'
import { todayCalendarISO } from './calendar-date'

function mapProduct(p: Record<string, unknown>): ProductRow {
  const ros = p.requireOpenStock ?? p.RequireOpenStock
  const dip = p.displayInPOS ?? p.DisplayInPOS
  return {
    id: String(p.id ?? p.Id ?? ''),
    code: String(p.code ?? p.Code ?? ''),
    name: String(p.name ?? p.Name ?? ''),
    unitPrice: Number(p.unitPrice ?? p.UnitPrice ?? 0),
    categoryId: String(p.categoryId ?? p.CategoryId ?? ''),
    categoryName: String(p.categoryName ?? p.CategoryName ?? ''),
    sortOrder: Number(p.sortOrder ?? p.SortOrder ?? 0),
    requireOpenStock: ros === undefined || ros === null ? true : Boolean(ros),
    displayInPOS: dip === undefined || dip === null ? true : Boolean(dip),
  }
}

function mapCategory(c: Record<string, unknown>): CategoryRow {
  return {
    id: String(c.id ?? c.Id ?? ''),
    name: String(c.name ?? c.Name ?? ''),
    code: c.code != null ? String(c.code) : c.Code != null ? String(c.Code) : undefined,
    sortOrder: Number(c.sortOrder ?? c.SortOrder ?? 0),
  }
}

/**
 * Download full catalogue from live API (dms_erp_db via backend).
 * Pagination uses server totalCount + raw page size so DisplayInPOS filtering
 * cannot stop the loop early.
 */
export async function syncCatalogFromServer(): Promise<void> {
  const pageSize = 200
  const maxPages = 50

  let page = 1
  let totalCount = 0
  let fetchedRaw = 0
  const prods: ProductRow[] = []
  try {
    do {
      const res = await fetchProductsPage(page, pageSize, { asOf: todayCalendarISO() })
      totalCount = Number(res.totalCount ?? 0)
      const batch = (res.products as Record<string, unknown>[]).map(mapProduct)
      const rawCount = Number(res.rawCount ?? batch.length)
      fetchedRaw += rawCount

      if (page === 1 && rawCount === 0) {
        throw new Error(
          'Server returned no products. Sign in again or ask an administrator to refresh the catalogue.',
        )
      }

      prods.push(...batch)

      // Stop when API page is short, or we have walked all server rows
      if (rawCount < pageSize || fetchedRaw >= totalCount) break
      page += 1
    } while (page <= maxPages)

    if (prods.length === 0) {
      throw new Error(
        'No POS products downloaded. Run .\\scripts\\fix-pos-catalog.ps1 on the server then re-sync.',
      )
    }
  } catch (err) {
    throw new Error(`Products download failed: ${formatSubmitError(err)}`)
  }

  page = 1
  totalCount = 0
  fetchedRaw = 0
  const cats: CategoryRow[] = []
  try {
    do {
      const res = await fetchCategoriesPage(page, pageSize)
      totalCount = Number(res.totalCount ?? 0)
      const batch = (res.categories as Record<string, unknown>[]).map(mapCategory)
      const rawCount = Number(res.rawCount ?? batch.length)
      fetchedRaw += rawCount
      cats.push(...batch)
      if (rawCount < pageSize || fetchedRaw >= totalCount) break
      page += 1
    } while (page <= maxPages)
  } catch (err) {
    throw new Error(`Categories download failed: ${formatSubmitError(err)}`)
  }

  if (prods.length === 0) {
    const existingProducts = await offlineDb.products.toArray()
    if (existingProducts.length > 0) {
      console.warn('[catalog-sync] Server returned 0 products; keeping existing local cache.')
      return
    }
    throw new Error(
      'Server returned 0 products. On the server run: .\\scripts\\fix-pos-catalog.ps1 then log out and log in again.',
    )
  }

  await replaceOfflineCatalog(prods, cats)

  useSettingsStore.getState().setCacheUpdatedAt(Date.now())
  console.log(
    `[catalog-sync] Synced ${prods.length} products, ${cats.length} categories`,
  )
}

export async function loadProductsIntoDb(): Promise<ProductRow[]> {
  const local = await offlineDb.products.toArray()
  if (local.length > 0) return local
  await syncCatalogFromServer()
  return offlineDb.products.toArray()
}

/** All active products (ignores Display In POS). Transfer / Delivery Return only. */
export async function loadAllActiveProducts(): Promise<ProductRow[]> {
  const pageSize = 200
  const maxPages = 50
  try {
    let page = 1
    let totalCount = 0
    let fetchedRaw = 0
    const prods: ProductRow[] = []
    do {
      const res = await fetchProductsPage(page, pageSize, { posVisibleOnly: false, asOf: todayCalendarISO() })
      totalCount = Number(res.totalCount ?? 0)
      const batch = (res.products as Record<string, unknown>[]).map(mapProduct)
      const rawCount = Number(res.rawCount ?? batch.length)
      fetchedRaw += rawCount
      prods.push(...batch)
      if (rawCount < pageSize || fetchedRaw >= totalCount) break
      page += 1
    } while (page <= maxPages)
    if (prods.length > 0) return prods
  } catch {
    /* offline — fall back to POS cache */
  }
  return loadProductsIntoDb()
}

export async function loadCategoriesIntoDb(): Promise<CategoryRow[]> {
  const local = await offlineDb.categories.toArray()
  if (local.length > 0) return local
  await syncCatalogFromServer()
  return offlineDb.categories.toArray()
}
