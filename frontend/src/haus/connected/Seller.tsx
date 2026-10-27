import { sellerArtworkTypes } from "../fixtures";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError, message, type Lot } from "../../api";
import { useSession } from "../../session";
import { SellerLots } from "./SellerLots";
import { BackButton } from "../shared";

type Artwork = {
  articArtworkId: number;
  name: string;
  imageUrl: string | null;
  isPublicDomain: boolean | null;
  artistDisplay: string | null;
  mediumDisplay?: string | null;
  provider?: string;
};
type Search = {
  items: Artwork[];
  page: number;
  total: number;
  provider: string;
};
const amountPattern = /^(?!0+(?:\.0{1,2})?$)\d{1,17}(?:\.\d{1,2})?$/;

export function Seller({ open }: { open: (id: string) => void }) {
  const { session } = useSession();
  const [tab, setTab] = useState<"lots" | "create">("lots");
  const [query, setQuery] = useState("");
  const [artworkType, setArtworkType] = useState("");
  const [results, setResults] = useState<Search | null>(null);
  const [selected, setSelected] = useState<Artwork | null>(null);
  const [published, setPublished] = useState<Lot | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const searched = useRef({ q: "", type: "" });
  useEffect(() => () => controller.current?.abort(), []);
  if (!session) return null;
  if (session.user.role !== "auctioneer")
    return (
      <section className="hs-utility-page">
        <BackButton />
        <p role="alert">Seller tools require an auctioneer account.</p>
      </section>
    );

  async function search(page = 1, filters = searched.current) {
    const q = filters.q.trim(),
      type = filters.type;
    if (!q && !type) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError("");
    setResults(null);
    searched.current = { q, type };
    try {
      const result = await api<Search>(
        `/catalog/search?${new URLSearchParams({ ...(q ? { q } : {}), ...(type ? { type } : {}), page: String(page), limit: "9" })}`,
        undefined,
        { signal: request.signal },
      );
      if (!request.signal.aborted) setResults(result);
    } catch (e) {
      if (!request.signal.aborted) setError(message(e));
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }
  async function select(artwork: Artwork) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const detail = await api<Artwork>(
        `/catalog/artworks/${artwork.articArtworkId}`,
      );
      if (!detail.imageUrl || detail.isPublicDomain !== true)
        throw new Error("Choose a public-domain artwork with an image.");
      setSelected(detail);
    } catch (e) {
      setError(message(e));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !selected || pending.current || uncertain) return;
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    const startingBid = value("startingBid"),
      bidIncrement = value("bidIncrement"),
      estimatedValue = value("estimatedValue");
    if (
      ![startingBid, bidIncrement, estimatedValue].every((x) =>
        amountPattern.test(x),
      )
    ) {
      setError(
        "Enter positive USD amounts with at most 17 integer digits and two decimals.",
      );
      return;
    }
    const start = new Date(value("startTime")),
      end = new Date(value("endTime"));
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      start.getTime() <= Date.now() ||
      end <= start
    ) {
      setError("Choose a future start and an end after the start.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api<Lot>("/lots", session.token, {
        method: "POST",
        body: JSON.stringify({
          title: value("title"),
          artworkId: selected.articArtworkId,
          startingBid,
          bidIncrement,
          estimatedValue,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        }),
      });
      setPublished(result);
    } catch (e) {
      if (!(e instanceof ApiError) || e.status >= 500) {
        setUncertain(true);
        setError(
          "Publication was not confirmed. Check MY LOTS before creating another lot; the request may have succeeded.",
        );
      } else setError(message(e));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function cancel() {
    if (!session || !published || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await api(`/lots/${published.id}/cancel`, session.token, {
        method: "PATCH",
        body: "{}",
      });
      setCancelled(true);
    } catch (e) {
      setError(message(e));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="hs-tools-preview hs-seller-page"
      style={{ display: "block" }}
      aria-label="Seller Studio"
    >
      <BackButton />
      <div className="hs-seller">
        <div className="hs-seller-heading">
          <div>
            <p className="hs-seller-eyebrow">PRIVATE AREA / AUCTIONEER</p>
            <h1>SELLER STUDIO</h1>
            <p className="hs-seller-intro">
              Manage your collection and publish auctions.
            </p>
          </div>
        </div>
        <div className="hs-seller-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "lots"}
            disabled={busy}
            onClick={() => setTab("lots")}
          >
            MY LOTS
          </button>
          <button
            role="tab"
            aria-selected={tab === "create"}
            disabled={busy}
            onClick={() => setTab("create")}
          >
            CREATE A LOT
          </button>
        </div>
        {tab === "lots" && (
          <SellerLots open={open} create={() => setTab("create")} />
        )}
        <div hidden={tab !== "create"}>
          {error && (
            <p role="alert" className="hs-seller-error">
              {error}
            </p>
          )}
          {published ? (
            <div className="hs-seller-form-panel">
              <h2>{cancelled ? "LOT CANCELLED" : "LOT PUBLISHED"}</h2>
              <p>{published.title}</p>
              <p>Lot ID: {published.id}</p>
              {!cancelled && (
                <>
                  <button
                    className="hs-seller-btn"
                    onClick={() => open(published.id)}
                  >
                    VIEW LOT
                  </button>
                  <button
                    className="hs-seller-btn ghost"
                    disabled={busy}
                    onClick={() => void cancel()}
                  >
                    CANCEL LOT
                  </button>
                  <p>
                    Cancellation is allowed only before any bids and before the
                    deadline.
                  </p>
                </>
              )}
              <button
                className="hs-seller-text-link"
                disabled={busy}
                onClick={() => {
                  setPublished(null);
                  setSelected(null);
                  setCancelled(false);
                  setError("");
                }}
              >
                CREATE ANOTHER LOT
              </button>
            </div>
          ) : selected ? (
            <div className="hs-seller-detail-layout">
              <aside className="hs-seller-artwork-panel">
                <img
                  src={selected.imageUrl!}
                  alt={selected.name}
                  style={{ maxWidth: "100%" }}
                />
                <h2>{selected.name}</h2>
                <p>{selected.artistDisplay}</p>
                <p>{selected.mediumDisplay}</p>
                <p>Source: {selected.provider}</p>
              </aside>
              <section className="hs-seller-form-panel">
                <h2>CONFIGURE THE AUCTION</h2>
                <form onSubmit={(event) => void publish(event)}>
                  <fieldset
                    disabled={busy || uncertain}
                    style={{ border: 0, padding: 0 }}
                  >
                    <label className="hs-seller-field">
                      LOT TITLE
                      <input
                        className="hs-seller-input"
                        name="title"
                        defaultValue={selected.name}
                        maxLength={200}
                        required
                      />
                    </label>
                    {[
                      ["startTime", "START DATE & TIME"],
                      ["endTime", "END DATE & TIME"],
                    ].map(([name, label]) => (
                      <label className="hs-seller-field" key={name}>
                        {label}
                        <input
                          className="hs-seller-input"
                          type="datetime-local"
                          name={name}
                          required
                        />
                      </label>
                    ))}
                    <p>Times use your device's local time zone.</p>
                    {[
                      ["startingBid", "STARTING BID (USD)"],
                      ["bidIncrement", "MINIMUM INCREMENT (USD)"],
                      ["estimatedValue", "ESTIMATED VALUE (USD)"],
                    ].map(([name, label]) => (
                      <label className="hs-seller-field" key={name}>
                        {label}
                        <input
                          className="hs-seller-input"
                          name={name}
                          inputMode="decimal"
                          required
                        />
                      </label>
                    ))}
                    <button className="hs-seller-btn" type="submit">
                      {busy ? "PUBLISHING…" : "PUBLISH LOT"}
                    </button>
                  </fieldset>
                </form>
                {!uncertain && (
                  <button
                    className="hs-seller-text-link"
                    disabled={busy}
                    onClick={() => {
                      setSelected(null);
                      setError("");
                    }}
                  >
                    CHANGE ARTWORK
                  </button>
                )}
              </section>
            </div>
          ) : (
            <section className="hs-seller-search-panel">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void search(1, { q: query, type: artworkType });
                }}
              >
                <label className="hs-seller-field">
                  ARTWORK / ARTIST
                  <input
                    className="hs-seller-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    maxLength={100}
                  />
                </label>
                <label
                  className="hs-seller-field"
                  htmlFor="catalog-artwork-type"
                >
                  ARTWORK TYPE
                </label>
                <select
                  id="catalog-artwork-type"
                  className="hs-seller-input"
                  value={artworkType}
                  onChange={(e) => setArtworkType(e.target.value)}
                >
                  <option value="">ALL TYPES</option>
                  {sellerArtworkTypes.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  className="hs-seller-btn"
                  disabled={busy || (!query.trim() && !artworkType)}
                  type="submit"
                >
                  {busy ? "LOADING…" : "SEARCH"}
                </button>
              </form>
              {results && (
                <>
                  <p role="status">
                    {results.total} artworks · Source: {results.provider}
                  </p>
                  <div className="hs-seller-art-grid">
                    {results.items
                      .filter(
                        (art) => art.imageUrl && art.isPublicDomain === true,
                      )
                      .map((art) => (
                        <button
                          type="button"
                          className="hs-seller-art-card"
                          key={art.articArtworkId}
                          disabled={busy}
                          onClick={() => void select(art)}
                          aria-label={`Select ${art.name}`}
                        >
                          <div className="hs-seller-art-frame">
                            <img
                              src={art.imageUrl!}
                              alt={art.name}
                              onError={(event) => {
                                const button =
                                  event.currentTarget.closest("button");
                                if (button) button.disabled = true;
                              }}
                            />
                          </div>
                          <div className="hs-seller-art-info">
                            <h3>{art.name}</h3>
                            <p>{art.artistDisplay}</p>
                          </div>
                        </button>
                      ))}
                  </div>
                  {!results.items.some(
                    (art) => art.imageUrl && art.isPublicDomain === true,
                  ) && <p>No artworks found. Try another search.</p>}
                  <div className="hs-seller-pagination">
                    <button
                      className="hs-seller-btn ghost"
                      disabled={busy || results.page <= 1}
                      onClick={() => void search(results.page - 1)}
                    >
                      PREVIOUS
                    </button>
                    <span>PAGE {results.page}</span>
                    <button
                      className="hs-seller-btn ghost"
                      disabled={
                        busy ||
                        results.page >= 100 ||
                        results.page * 9 >= results.total
                      }
                      onClick={() => void search(results.page + 1)}
                    >
                      NEXT
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
