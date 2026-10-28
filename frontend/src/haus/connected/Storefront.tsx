import { useEffect, useRef, useState } from "react";
import type { Lot } from "../../api";
import { useHaus, clock } from "../model";
import { translations } from "../translations";
import {
  dollars,
  useApiQuery,
  type BidSummary,
  type PageResult,
} from "./queries";
export function Artwork({
  lot,
  className,
}: {
  lot: Pick<Lot, "items">;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const item = lot.items[0];
  return item?.imageUrl && !failed ? (
    <img
      src={item.imageUrl}
      className={className}
      alt={item.name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <span>Image unavailable</span>
  );
}
function PublishedLotCard({
  lot,
  open,
}: {
  lot: Lot;
  open: (id: string) => void;
}) {
  const { lang } = useHaus(),
    s = translations[lang],
    item = lot.items[0];
  return (
    <article className="hs-lot-card">
      <button
        className="hs-card-artwork"
        aria-label={`View ${lot.title}`}
        onClick={() => open(lot.id)}
      >
        <Artwork lot={lot} />
      </button>
      <div className="hs-card-topline">
        <span>
          {lot.status === "open" && <span className="hs-live-dot" />}
          {lot.status === "open"
            ? s.live
            : lot.status === "scheduled"
              ? s.upcoming
              : lang === "PT"
                ? "ENCERRADO"
                : "CLOSED"}
        </span>
        {item?.sourceSnapshot?.provider === "mock" && (
          <span>DEVELOPMENT CATALOG</span>
        )}
      </div>
      <button className="hs-card-info" onClick={() => open(lot.id)}>
        <span className="hs-card-artist">
          {item?.artistDisplay || "Artist not listed"} /{" "}
          {item?.sourceSnapshot?.dateDisplay || "—"}
        </span>
        <h3>{lot.title}</h3>
      </button>
      <div className="hs-card-bottom">
        <div>
          <p>{lang === "PT" ? "LANCE INICIAL" : "STARTING BID"}</p>
          <strong>{dollars(lot.startingBid, lot.currency)}</strong>
        </div>
        <button onClick={() => open(lot.id)} aria-label="Open lot">
          ↗
        </button>
      </div>
    </article>
  );
}
function FeaturedLot({
  lot,
  open,
}: {
  lot: Lot | null;
  open: (id: string) => void;
}) {
  const { lang, now } = useHaus(),
    s = translations[lang];
  const bids = useApiQuery<BidSummary>(
    lot ? `/lots/${lot.id}/bids?page=1&limit=1` : null,
  );
  const received = useRef({ data: bids.data, at: now });
  if (received.current.data !== bids.data)
    received.current = { data: bids.data, at: now };
  const serverNow = bids.data
    ? Date.parse(bids.data.serverTime) + now - received.current.at
    : now;
  const item = lot?.items[0];
  return (
    <section className={`hs-hero${lot ? "" : " is-empty"}`}>
      <div className="hs-hero-copy">
        <div className="hs-hero-inner">
          <div className="hs-eyebrow">
            <span className="hs-live-dot" />
            <span>
              {lot
                ? s.live
                : lang === "PT"
                  ? "NENHUM LEILÃO AO VIVO"
                  : "NO LIVE AUCTIONS"}
            </span>
          </div>
          <div className="hs-hero-title-block">
            <p className="hs-collection">
              {lang === "PT" ? "A COLEÇÃO" : "THE COLLECTION"}
            </p>
            <h1 className="hs-hero-title">
              {lot?.title || (lang === "PT" ? "EM BREVE" : "COMING SOON")}
            </h1>
            <p className="hs-artist">
              {lot ? (
                <>
                  {item?.artistDisplay || "Artist not listed"}{" "}
                  <span>/ {item?.sourceSnapshot?.dateDisplay || "—"}</span>
                </>
              ) : lang === "PT" ? (
                "Novos lotes serão anunciados em breve."
              ) : (
                "New lots will be announced shortly."
              )}
            </p>
          </div>
          <div className="hs-hero-action-block">
            <div className="hs-hero-meta">
              <div>
                <span className="hs-meta-label">{s.bid}</span>
                <span className="hs-meta-number">
                  {bids.data
                    ? dollars(
                        bids.data.currentBid ?? bids.data.startingBid,
                        bids.data.currency,
                      )
                    : "—"}
                </span>
              </div>
              <div>
                <span className="hs-meta-label">{s.time}</span>
                <span className="hs-meta-number">
                  {bids.data
                    ? clock(Date.parse(bids.data.endTime), serverNow)
                    : "—"}
                </span>
              </div>
            </div>
            <button
              className="hs-primary-link"
              disabled={!lot}
              onClick={() => lot && open(lot.id)}
            >
              <span>{s.view}</span>
              <span>↗</span>
            </button>
            {bids.error && (
              <p className="hs-seller-error" role="alert">
                Current bid unavailable. Open the lot to retry.
              </p>
            )}
          </div>
        </div>
        <button
          className="hs-hero-down"
          onClick={() =>
            document
              .getElementById("catalog")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >
          <span>{s.explore}</span>
          <span>↓</span>
        </button>
      </div>
      <button
        className="hs-hero-art"
        aria-label="View featured lot"
        disabled={!lot}
        onClick={() => lot && open(lot.id)}
      >
        {lot && <Artwork key={lot.id} lot={lot} className="hs-hero-painting" />}
        <span className="hs-art-caption">
          {item?.sourceSnapshot?.provider?.toUpperCase() || "HAUS SAMPAIO"} /
          COLLECTION
        </span>
      </button>
    </section>
  );
}
export function Storefront({ open }: { open: (id: string) => void }) {
  const { lang } = useHaus(),
    s = translations[lang];
  const [filter, setFilter] = useState(""),
    [page, setPage] = useState(1),
    [query, setQuery] = useState("");
  const lots = useApiQuery<PageResult<Lot>>(
    `/lots?page=${page}&limit=9${filter ? `&status=${filter}` : ""}`,
  );
  const live = useApiQuery<PageResult<Lot>>("/lots?status=open&page=1&limit=1");
  const data = lots.data;
  const filtered =
    data?.items.filter((l) =>
      `${l.title} ${l.items[0]?.artistDisplay || ""}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    ) || [];
  // Initial HTTP load plus WebSocket invalidation; filters and pagination stay applied.
  useEffect(() => {
    setQuery("");
  }, [filter, page]);
  return (
    <div id="landing" className="hs-home-page">
      {live.loading ? (
        <section className="hs-main" role="status">
          Loading auctions…
        </section>
      ) : live.error ? (
        <section className="hs-main">
          <p className="hs-seller-error" role="alert">
            {live.error}
          </p>
          <button className="hs-underlined" onClick={live.refresh}>
            RETRY FEATURED LOT
          </button>
        </section>
      ) : (
        <FeaturedLot
          key={live.data?.items[0]?.id || "empty"}
          lot={live.data?.items[0] || null}
          open={open}
        />
      )}
      <section className="hs-main" id="catalog">
        <div className="hs-section-header">
          <div>
            <p className="hs-index">
              01 / <span>{s.collection}</span>
            </p>
            <h2 className="hs-title">{s.title}</h2>
            <p className="hs-subtitle">{s.sub}</p>
          </div>
          <span className="hs-live-count">
            <span className="hs-live-dot" />
            {live.data ? `${live.data.total} ${s.live}` : "—"}
          </span>
        </div>
        <div className="hs-controls">
          <div className="hs-tabs" role="tablist">
            {[
              ["", s.all],
              ["open", s.live],
              ["scheduled", s.upcoming],
              ["closed", lang === "PT" ? "ENCERRADOS" : "CLOSED"],
            ].map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={filter === id}
                onClick={() => {
                  setFilter(id);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="hs-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              aria-label="Search this page"
              placeholder={
                lang === "PT" ? "Buscar nesta página" : "Search this page"
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        {lots.error ? (
          <p role="alert" className="hs-seller-error">
            {lots.error}
          </p>
        ) : lots.loading ? (
          <p role="status">Loading lots…</p>
        ) : (
          <div className="hs-grid">
            {filtered.length ? (
              filtered.map((l) => (
                <PublishedLotCard key={l.id} lot={l} open={open} />
              ))
            ) : (
              <div className="hs-empty">
                {query ? "NO MATCHES ON THIS PAGE" : "NO LOTS FOUND"}
              </div>
            )}
          </div>
        )}
        <div className="hs-seller-pagination">
          <span>
            {data
              ? `PAGE ${page} OF ${Math.max(1, Math.ceil(data.total / 9))} · ${data.total} LOTS`
              : ""}
          </span>
          <div>
            <button
              className="hs-seller-btn ghost"
              disabled={page <= 1 || lots.loading}
              onClick={() => setPage((p) => p - 1)}
            >
              ← PREVIOUS
            </button>
            <button
              className="hs-seller-btn ghost"
              disabled={!data || page * 9 >= data.total || lots.loading}
              onClick={() => setPage((p) => p + 1)}
            >
              NEXT →
            </button>
          </div>
        </div>
        <button
          className="hs-underlined"
          onClick={() => {
            lots.refresh();
            live.refresh();
          }}
        >
          REFRESH LOTS
        </button>
      </section>
    </div>
  );
}
