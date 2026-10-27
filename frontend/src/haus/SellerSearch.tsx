import { useEffect, useRef, useState } from "react";
import { catalogBase, normalizeArtwork } from "./catalog";
import { sellerArtworkTypes, sellerSample } from "./fixtures";
import type { CatalogArtwork } from "./types";
export function SellerSearch({
  onSelect,
}: {
  onSelect: (art: CatalogArtwork) => void;
}) {
  const [query, setQuery] = useState(""),
    [type, setType] = useState("");
  const [applied, setApplied] = useState({ query: "", type: "" });
  const [results, setResults] = useState<CatalogArtwork[]>([]),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0);
  const [source, setSource] = useState("idle"),
    [notice, setNotice] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function search(next: number, filters = applied) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    if (!filters.query.trim() && !filters.type) {
      setResults([]);
      setSource("empty");
      setNotice(
        "Enter an artwork / artist or select an artwork type to search.",
      );
      return;
    }
    setApplied(filters);
    setPage(next);
    setSource("loading");
    setNotice("SEARCHING THE CLEVELAND COLLECTION…");
    const url = new URL(catalogBase);
    if (filters.query.trim()) url.searchParams.set("q", filters.query.trim());
    if (filters.type) url.searchParams.set("type", filters.type);
    url.searchParams.set("has_image", "1");
    url.searchParams.set("skip", String((next - 1) * 9));
    url.searchParams.set("limit", "9");
    url.search += "&cc0";
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw Error("Catalog unavailable");
      const payload = await response.json();
      if (!Array.isArray(payload.data)) throw Error("Unexpected response");
      if (request.current !== controller) return;
      const found = payload.data
        .map(normalizeArtwork)
        .filter((a: CatalogArtwork | null): a is CatalogArtwork => a !== null);
      setResults(found);
      setTotal(Math.max(0, Number(payload.info?.total) || 0));
      setSource("ready");
      setNotice(
        found.length
          ? `${found.length} WORKS ON THIS PAGE${filters.type ? " · " + filters.type.toUpperCase() : ""} · PUBLIC DOMAIN / WITH IMAGE`
          : "No image-bearing public-domain works found for this search.",
      );
    } catch {
      if (request.current !== controller) return;
      setResults([]);
      setTotal(0);
      setSource("error");
      setNotice(
        "CATALOG CURRENTLY UNAVAILABLE · You can retry or use the sample artwork.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
  return (
    <>
      <section aria-labelledby="seller-search-title">
        <div className="hs-seller-subheading hs-seller-search-head">
          <div>
            <h3 className="hs-seller-section-title" id="seller-search-title">
              01 / SELECT AN ARTWORK
            </h3>
            <p className="hs-seller-notice">
              Explore public-domain works from the Cleveland Museum of Art. Only
              works with images are shown.
            </p>
          </div>
          <span className="hs-seller-source-tag">CLEVELAND / OPEN ACCESS</span>
        </div>
        <form
          className="hs-seller-search-form"
          onSubmit={(e) => {
            e.preventDefault();
            void search(1, { query, type });
          }}
        >
          <div className="hs-seller-search-controls">
            <div className="hs-seller-fieldset">
              <label className="hs-seller-field" htmlFor="seller-search">
                ARTWORK / ARTIST{" "}
                <span className="hs-seller-optional">OPTIONAL</span>
              </label>
              <input
                id="seller-search"
                className="hs-seller-input"
                type="search"
                maxLength={100}
                placeholder="e.g. Claude Monet"
                value={query}
                autoComplete="off"
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="hs-seller-fieldset">
              <label className="hs-seller-field" htmlFor="seller-artwork-type">
                ARTWORK TYPE
              </label>
              <select
                id="seller-artwork-type"
                className="hs-seller-input hs-seller-select"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="">ALL TYPES</option>
                {sellerArtworkTypes.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="hs-seller-btn"
              disabled={source === "loading"}
            >
              {source === "loading" ? (
                "SEARCHING…"
              ) : (
                <>
                  SEARCH <span aria-hidden="true">↗</span>
                </>
              )}
            </button>
          </div>
          <p className="hs-seller-field-hint">
            Search by artwork/artist, select a type, or combine both filters.
          </p>
        </form>
        <div role="status" aria-live="polite" className="hs-seller-search-meta">
          {notice}
        </div>
        <div>
          {source === "loading" ? (
            <div className="hs-seller-empty hs-seller-result-empty">
              Searching the collection…
            </div>
          ) : source === "idle" ? (
            <div className="hs-seller-empty hs-seller-result-empty">
              <span>THE COLLECTION</span>
              <p>
                Search by artwork / artist or choose an artwork type to explore
                the collection.
              </p>
            </div>
          ) : !results.length ? (
            <div className="hs-seller-empty hs-seller-result-empty">
              <span>NO WORKS FOUND</span>
              <p>
                {source === "error"
                  ? "The catalog could not be reached. You can retry or use the sample artwork below."
                  : "Try another artwork / artist or artwork type."}
              </p>
            </div>
          ) : (
            <>
              <div className="hs-seller-art-grid">
                {results.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="hs-seller-art-card"
                    onClick={() => onSelect(a)}
                    aria-label={`Select ${a.title}`}
                  >
                    <div className="hs-seller-art-frame">
                      <img
                        src={a.image}
                        alt={a.title}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget
                            .closest(".hs-seller-art-card")
                            ?.classList.add("image-error");
                          e.currentTarget.alt = "Image unavailable";
                        }}
                      />
                    </div>
                    <div className="hs-seller-art-info">
                      <span className="hs-seller-art-id">CMA / {a.id}</span>
                      <h4>{a.title}</h4>
                      <p>
                        {a.artist}
                        {a.year && ` · ${a.year}`}
                      </p>
                      <span className="hs-seller-art-action">
                        SELECT WORK <span aria-hidden="true">↗</span>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              {total > 9 && (
                <div className="hs-seller-pagination">
                  <span>
                    PAGE {page} OF {Math.ceil(total / 9)} ·{" "}
                    {total.toLocaleString("en-US")} WORKS
                  </span>
                  <div>
                    <button
                      type="button"
                      className="hs-seller-btn ghost"
                      disabled={page === 1}
                      onClick={() => void search(page - 1)}
                    >
                      ← PREVIOUS
                    </button>
                    <button
                      type="button"
                      className="hs-seller-btn ghost"
                      disabled={page * 9 >= total}
                      onClick={() => void search(page + 1)}
                    >
                      NEXT →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
      <div className="hs-seller-demo-footnote">
        <span>VISUAL PROTOTYPE</span>
        <p>
          Prefer to test the flow without the catalog API?{" "}
          <button
            type="button"
            className="hs-seller-text-link"
            onClick={() => onSelect({ ...sellerSample })}
          >
            USE A SAMPLE ARTWORK ↗
          </button>
        </p>
      </div>
    </>
  );
}
