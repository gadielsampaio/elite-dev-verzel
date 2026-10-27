import { Fragment, useEffect, useRef, useState } from "react";
import { clock, current, money, status, useHaus } from "./model";
import { translations } from "./translations";
import type { Lot } from "./types";
export function HeroCarousel() {
  const { lots, lang, now, activeId, setActiveId } = useHaus();
  const [position, setPosition] = useState(0);
  const hover = useRef(false);
  const live = lots.filter((l) => status(l, now) === "live");
  const lot = live[position % (live.length || 1)];
  const s = translations[lang];
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden && !activeId && !hover.current && live.length > 1)
        setPosition((p) => (p + 1) % live.length);
    }, 6500);
    return () => clearInterval(timer);
  }, [live.length, activeId, position]);
  const open = () => {
    if (lot) setActiveId(lot.id);
  };
  const cleveland = lot?.provider === "cleveland";
  return (
    <section
      className={`hs-hero${lot ? "" : " is-empty"}`}
      onMouseEnter={() => {
        hover.current = true;
      }}
      onMouseLeave={() => {
        hover.current = false;
      }}
    >
      <div className="hs-hero-copy">
        <div className="hs-hero-inner">
          <div className="hs-eyebrow">
            <span className="hs-live-dot" />
            <span id="hero-live">
              {lot
                ? s.live
                : lang === "PT"
                  ? "NENHUM LEILÃO AO VIVO"
                  : "NO LIVE AUCTIONS"}
            </span>
            <span className="hs-hero-no" id="hero-lot-number">
              {lot && `/ LOT ${String(lots.indexOf(lot) + 1).padStart(3, "0")}`}
            </span>
          </div>
          <div className="hs-hero-title-block">
            <p className="hs-collection" id="hero-collection">
              THE {cleveland ? "CLEVELAND" : "CHICAGO"} COLLECTION — 2026
            </p>
            <h1 className="hs-hero-title" id="hero-title">
              {lot?.title || (lang === "PT" ? "EM BREVE" : "COMING SOON")}
            </h1>
            <p className="hs-artist" id="hero-artist">
              {lot ? (
                <>
                  {lot.artist} <span>/ {lot.year}</span>
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
                  {lot ? money(current(lot)) : "—"}
                </span>
              </div>
              <div>
                <span className="hs-meta-label">{s.time}</span>
                <span className="hs-meta-number" id="hero-time">
                  {lot ? clock(lot.endsAt, now) : "—"}
                </span>
              </div>
            </div>
            <button
              className="hs-primary-link"
              id="hero-lot-action"
              disabled={!lot}
              onClick={open}
            >
              <span>{s.view}</span>
              <span>↗</span>
            </button>
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
        aria-label="View featured lot"
        className="hs-hero-art"
        id="hero-art-button"
        disabled={!lot}
        onClick={open}
      >
        <img
          alt={lot ? `${lot.title} by ${lot.artist}` : "Collection preview"}
          className="hs-hero-painting"
          src={lot?.image || lots[0]?.image}
        />
        <span className="hs-art-caption">
          {cleveland
            ? "CLEVELAND MUSEUM OF ART / OPEN ACCESS"
            : "ART INSTITUTE OF CHICAGO / PUBLIC COLLECTION"}
        </span>
      </button>
      <nav aria-label="Live auction carousel" className="hs-hero-pagination">
        {live.length > 1 && (
          <>
            <button
              aria-label="Previous live lot"
              onClick={() =>
                setPosition((p) => (p - 1 + live.length) % live.length)
              }
            >
              ←
            </button>
            <span className="hs-hero-counter">
              {String((position % live.length) + 1).padStart(2, "0")} /{" "}
              {String(live.length).padStart(2, "0")}
            </span>
            <button
              aria-label="Next live lot"
              onClick={() => setPosition((p) => (p + 1) % live.length)}
            >
              →
            </button>
          </>
        )}
      </nav>
    </section>
  );
}
export function LotCard({ lot }: { lot: Lot }) {
  const { lots, lang, now, setActiveId } = useHaus();
  const state = status(lot, now),
    s = translations[lang];
  const open = () => setActiveId(lot.id);
  return (
    <article className="hs-lot-card">
      <button
        className="hs-card-artwork"
        aria-label={`View ${lot.title}`}
        onClick={open}
      >
        <img
          src={lot.image}
          alt={`${lot.title} by ${lot.artist}`}
          loading="lazy"
        />
      </button>
      <div className="hs-card-topline">
        <span>
          {state === "live" && (
            <>
              <span className="hs-live-dot" />{" "}
            </>
          )}
          {state === "live"
            ? s.live
            : state === "scheduled"
              ? s.upcoming
              : s.results}
        </span>
        <span>LOT {String(lots.indexOf(lot) + 1).padStart(3, "0")}</span>
      </div>
      <button className="hs-card-info" onClick={open}>
        <span className="hs-card-artist">
          {lot.artist} / {lot.year}
        </span>
        <h3>{lot.title}</h3>
      </button>
      <div className="hs-card-bottom">
        <div>
          <p>
            {state === "live"
              ? s.bid
              : state === "scheduled"
                ? "STARTING BID"
                : "WINNING BID"}
          </p>
          <strong>{money(current(lot))}</strong>
        </div>
        <button onClick={open} aria-label="Open lot">
          ↗
        </button>
      </div>
    </article>
  );
}
export function HomePage() {
  const { lots, lang, now, go } = useHaus();
  const [filter, setFilter] = useState("all"),
    [query, setQuery] = useState("");
  const s = translations[lang];
  const found = lots.filter(
    (l) =>
      status(l, now) !== "cancelled" &&
      (filter === "all" || status(l, now) === filter) &&
      `${l.title} ${l.artist}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <div className="hs-home-page" id="landing">
      <HeroCarousel />
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
            <span>
              {lots.filter((l) => status(l, now) === "live").length} {s.live}
            </span>
          </span>
        </div>
        <div className="hs-controls">
          <div className="hs-tabs" role="tablist">
            {[
              ["all", s.all],
              ["live", s.live],
              ["scheduled", s.upcoming],
              ["closed", s.results],
            ].map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={filter === id}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="hs-search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Search artwork"
              id="search"
              placeholder={s.search}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <div className="hs-grid">
          {found.length ? (
            found.map((lot) => <LotCard key={lot.id} lot={lot} />)
          ) : (
            <div className="hs-empty">
              NO LOTS FOUND
              <br />
              <button
                className="hs-underlined"
                onClick={() => {
                  setFilter("all");
                  setQuery("");
                }}
              >
                VIEW ALL
              </button>
            </div>
          )}
        </div>
        <div className="hs-bottom-note">
          <p>
            {s.audit.split("<br/>").map((line, i) => (
              <Fragment key={line}>
                {i > 0 && <br />}
                {line}
              </Fragment>
            ))}
          </p>
          <button className="hs-underlined" onClick={() => go("audit")}>
            {s.auditAction}
          </button>
        </div>
      </section>
    </div>
  );
}
