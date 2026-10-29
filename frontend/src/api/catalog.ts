import { api } from "./client";
import type { CatalogSearchResult } from "../types/catalog";

const CATALOG_PAGE_SIZE = 9;

export function searchCatalog(
  page: number,
  filters: { q: string; type: string },
  signal: AbortSignal,
) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.type) params.set("type", filters.type);
  params.set("page", String(page));
  params.set("limit", String(CATALOG_PAGE_SIZE));

  return api<CatalogSearchResult>(`/catalog/search?${params}`, undefined, { signal });
}
