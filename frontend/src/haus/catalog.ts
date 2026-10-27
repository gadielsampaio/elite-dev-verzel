import type { CatalogArtwork } from "./types";
export const catalogBase =
  "https://openaccess-api.clevelandart.org/api/artworks";
export function normalizeArtwork(value: unknown): CatalogArtwork | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const images = item.images as { web?: { url?: unknown } } | undefined;
  if (
    !Number.isSafeInteger(item.id) ||
    typeof images?.web?.url !== "string" ||
    item.share_license_status !== "CC0"
  )
    return null;
  return {
    id: Number(item.id),
    title: String(item.title || "Untitled"),
    artist:
      (Array.isArray(item.creators)
        ? item.creators
            .map((c) => String(c.description || ""))
            .filter(Boolean)
            .join("; ")
        : "") || "Unknown artist",
    year: String(item.creation_date || ""),
    medium: String(item.technique || ""),
    artworkType: String(item.type || ""),
    image: images.web.url,
    isPublicDomain: true,
    provider: "cleveland",
    source: "api",
  };
}
