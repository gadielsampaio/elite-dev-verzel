import { MoneyInput } from "../../MoneyInput";
import { useApiQuery, dollars } from "./queries";
import { AccountResults } from "./AccountResults";
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
  dateDisplay?: string | null;
  artworkType?: string | null;
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

function localFuture(hours: number) {
  const date = new Date(Date.now() + hours * 3600000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function AuctionMoney({
  name,
  label,
  help,
  error,
}: {
  name: string;
  label: string;
  help?: string;
  error?: string;
}) {
  return (
    <div className="hs-seller-fieldset">
      <label className="hs-seller-field" htmlFor={`seller-${name}`}>
        {label}
      </label>
      <MoneyInput
        id={`seller-${name}`}
        className="hs-seller-input hs-money-input"
        name={name}
        aria-label={`${label} (USD)`}
        aria-invalid={!!error}
        aria-describedby={
          error
            ? `seller-${name}-error`
            : help
              ? `seller-${name}-help`
              : undefined
        }
      />
      {error && (
        <span
          id={`seller-${name}-error`}
          className="hs-seller-field-error"
          role="alert"
        >
          {error}
        </span>
      )}
      {help && (
        <span id={`seller-${name}-help`} className="hs-seller-field-hint">
          {help}
        </span>
      )}
    </div>
  );
}

export function Seller({ open }: { open: (id: string) => void }) {
  const { session } = useSession();
  const [tab, setTab] = useState<"lots" | "create" | "results">("lots");
  const [query, setQuery] = useState("");
  const [artworkType, setArtworkType] = useState("");
  const [results, setResults] = useState<Search | null>(null);
  const [selected, setSelected] = useState<Artwork | null>(null);
  const [published, setPublished] = useState<Lot | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [startMode, setStartMode] = useState("scheduled");
  const [startValue, setStartValue] = useState(() => localFuture(1));
  const fieldError = (name: string) =>
    fieldErrors[name] ? (
      <span
        id={`seller-${name}-error`}
        className="hs-seller-field-error"
        role="alert"
      >
        {fieldErrors[name]}
      </span>
    ) : null;
  const [uncertain, setUncertain] = useState(false);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const searched = useRef({ q: "", type: "" });
  useEffect(() => () => controller.current?.abort(), []);
  const summary = useApiQuery<{
    lots: number;
    live: number;
    sold: number;
    totalReceived: string;
    currency: string;
  }>(
    session?.user.role === "auctioneer" ? "/me/auction-summary" : null,
    session?.token,
  );
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
    const moneyValue = (name: string) => value(name).replace(/[$,]/g, "");
    const startingBid = moneyValue("startingBid"),
      bidIncrement = moneyValue("bidIncrement"),
      estimatedValue = moneyValue("estimatedValue");
    const errors: Record<string, string> = {};
    if (!value("title") || value("title").length > 200)
      errors.title = "Enter a title of 1–200 characters.";
    for (const [name, amount] of Object.entries({
      startingBid,
      bidIncrement,
      estimatedValue,
    })) {
      if (!amountPattern.test(amount))
        errors[name] = "Enter an amount greater than $0.00.";
    }
    const start =
      startMode === "now" ? new Date() : new Date(value("startTime"));
    const end = new Date(value("endTime"));
    if (
      !Number.isFinite(start.getTime()) ||
      (startMode !== "now" && start.getTime() <= Date.now())
    )
      errors.startTime = "Choose a future start time or Publish now.";
    if (!Number.isFinite(end.getTime()) || end <= start)
      errors.endTime = "End time must be after the start.";
    setFieldErrors(errors);
    setError("");
    if (Object.keys(errors).length) {
      event.currentTarget
        .querySelector<HTMLElement>(`[name="${Object.keys(errors)[0]}"]`)
        ?.focus();
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
          ...(startMode === "now"
            ? { startMode: "now" }
            : { startTime: start.toISOString() }),
          endTime: end.toISOString(),
        }),
      });
      setPublished(result);
      summary.refresh();
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
      summary.refresh();
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
            <h2>SELLER STUDIO</h2>
            <p className="hs-seller-intro">
              Manage your collection, live auctions and final results.
            </p>
          </div>
          <button
            className="hs-seller-btn"
            disabled={busy}
            onClick={() => setTab("create")}
          >
            CREATE LOT<span>+</span>
          </button>
        </div>
        <div className="hs-seller-stats">
          {[
            ["YOUR LOTS", summary.data?.lots ?? "—"],
            ["LIVE NOW", summary.data?.live ?? "—"],
            ["LOTS SOLD", summary.data?.sold ?? "—"],
            [
              "TOTAL RECEIVED",
              summary.data
                ? dollars(summary.data.totalReceived, summary.data.currency)
                : "—",
            ],
          ].map(([label, value]) => (
            <div className="hs-seller-stat" key={label}>
              <label>{label}</label>
              <strong title={value === "—" ? "Not available" : undefined}>
                {value}
              </strong>
            </div>
          ))}
        </div>
        {summary.error && (
          <p className="hs-seller-error" role="alert">
            Summary unavailable: {summary.error}
          </p>
        )}
        <button className="hs-seller-text-link" onClick={summary.refresh}>
          REFRESH SUMMARY
        </button>
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
          <button
            role="tab"
            aria-selected={tab === "results"}
            disabled={busy}
            onClick={() => setTab("results")}
          >
            RESULTS
          </button>
        </div>
        {tab === "results" && (
          <AccountResults seller open={open} onRefresh={summary.refresh} />
        )}
        {tab === "lots" && (
          <SellerLots
            open={open}
            create={() => setTab("create")}
            onChanged={summary.refresh}
          />
        )}
        <div hidden={tab !== "create"}>
          <div className="hs-seller-create-intro">
            <div>
              <p className="hs-seller-eyebrow">
                NEW AUCTION / {selected ? "STEP 02 OF 02" : "STEP 01 OF 02"}
              </p>
              <h3>CREATE A LOT</h3>
              <p>
                {selected
                  ? "Set the conditions for your selected work."
                  : "Choose a work from the public collection to begin."}
              </p>
            </div>
            <div
              className="hs-seller-progress"
              aria-label="Lot creation progress"
            >
              <div className={selected ? "is-done" : "is-active"}>
                <span className="hs-seller-step-number">
                  {selected ? "✓" : "01"}
                </span>
                <span>SELECT ARTWORK</span>
              </div>
              <span className="hs-seller-progress-line" aria-hidden="true" />
              <div className={selected ? "is-active" : ""}>
                <span className="hs-seller-step-number">02</span>
                <span>LOT DETAILS</span>
              </div>
            </div>
          </div>
          {error && (!selected || published) && (
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
            <>
              <div className="hs-seller-detail-toolbar">
                <button
                  className="hs-seller-text-link"
                  type="button"
                  disabled={busy || uncertain}
                  onClick={() => {
                    setSelected(null);
                    setError("");
                  }}
                >
                  ← BACK TO COLLECTION
                </button>
                <span>02 / LOT DETAILS</span>
              </div>
              <div className="hs-seller-detail-layout">
                <aside
                  className="hs-seller-artwork-panel"
                  aria-label="Selected artwork"
                >
                  <div className="hs-seller-artwork-display">
                    <img
                      src={selected.imageUrl!}
                      alt={selected.name}
                      onError={(e) =>
                        e.currentTarget.parentElement?.classList.add(
                          "image-error",
                        )
                      }
                    />
                  </div>
                  <div className="hs-seller-artwork-caption">
                    <div>
                      <span className="hs-seller-art-id">
                        SELECTED ARTWORK · CMA {selected.articArtworkId}
                      </span>
                      <h4>{selected.name}</h4>
                      <p>{selected.artistDisplay}</p>
                    </div>
                    <button
                      className="hs-seller-text-link"
                      aria-label="CHANGE ARTWORK"
                      type="button"
                      disabled={busy || uncertain}
                      onClick={() => {
                        setSelected(null);
                        setError("");
                      }}
                    >
                      CHANGE ↗
                    </button>
                  </div>
                  <dl className="hs-seller-artwork-details">
                    {[
                      ["YEAR", selected.dateDisplay || "Not listed"],
                      ["MEDIUM", selected.mediumDisplay || "Not listed"],
                      ["TYPE", selected.artworkType || "Not listed"],
                      [
                        "SOURCE",
                        selected.provider === "mock"
                          ? "Cleveland / offline fixtures"
                          : "Cleveland / open access",
                      ],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </aside>
                <section
                  className="hs-seller-form-panel"
                  aria-labelledby="seller-form-title"
                >
                  <h3
                    id="seller-form-title"
                    className="hs-seller-section-title"
                  >
                    CONFIGURE THE AUCTION
                  </h3>
                  <p className="hs-seller-notice">
                    Artwork information is provided by the museum. Set the
                    schedule and bidding conditions below.
                  </p>
                  <form noValidate onSubmit={(event) => void publish(event)}>
                    <fieldset
                      disabled={busy || uncertain}
                      style={{ border: 0, padding: 0, minWidth: 0 }}
                    >
                      <div className="hs-seller-fieldset">
                        <label
                          className="hs-seller-field"
                          htmlFor="seller-title"
                        >
                          LOT TITLE
                        </label>
                        <input
                          id="seller-title"
                          className="hs-seller-input"
                          name="title"
                          aria-invalid={!!fieldErrors.title}
                          aria-describedby="seller-title-error"
                          defaultValue={selected.name}
                          maxLength={200}
                          required
                        />
                        {fieldError("title")}
                      </div>
                      <div className="hs-seller-fieldset">
                        <label
                          className="hs-seller-field"
                          htmlFor="seller-start-mode"
                        >
                          PUBLICATION
                        </label>
                        <select
                          id="seller-start-mode"
                          className="hs-seller-input"
                          value={startMode}
                          onChange={(event) => {
                            setStartMode(event.target.value);
                            if (event.target.value === "scheduled")
                              setStartValue(localFuture(1));
                            setFieldErrors({});
                          }}
                        >
                          <option value="now">Publish now</option>
                          <option value="scheduled">
                            Schedule — one hour from now
                          </option>
                        </select>
                      </div>
                      <div className="hs-seller-form-grid">
                        {[
                          ["startTime", "START DATE & TIME", 1],
                          ["endTime", "END DATE & TIME", 25],
                        ].map(([name, label, hours]) => (
                          <div className="hs-seller-fieldset" key={name}>
                            <label
                              className="hs-seller-field"
                              htmlFor={`seller-${name}`}
                            >
                              {label}
                            </label>
                            <input
                              id={`seller-${name}`}
                              className="hs-seller-input"
                              type="datetime-local"
                              name={String(name)}
                              {...(name === "startTime"
                                ? {
                                    value: startValue,
                                    onChange: (
                                      event: React.ChangeEvent<HTMLInputElement>,
                                    ) => setStartValue(event.target.value),
                                    disabled: startMode === "now",
                                  }
                                : { defaultValue: localFuture(Number(hours)) })}
                              aria-invalid={!!fieldErrors[String(name)]}
                              aria-describedby={`seller-${name}-error`}
                              required
                            />
                            {name === "startTime" && startMode === "now" && (
                              <span className="hs-seller-field-hint">
                                Starts when the server publishes the lot.
                              </span>
                            )}
                            {fieldError(String(name))}
                          </div>
                        ))}
                      </div>
                      <p className="hs-seller-field-hint hs-seller-time-hint">
                        Times use your device's local time zone.
                      </p>
                      <div className="hs-seller-form-grid">
                        <AuctionMoney
                          name="startingBid"
                          label="STARTING BID"
                          error={fieldErrors.startingBid}
                        />
                        <AuctionMoney
                          error={fieldErrors.bidIncrement}
                          name="bidIncrement"
                          label="MINIMUM INCREMENT"
                        />
                      </div>
                      <AuctionMoney
                        error={fieldErrors.estimatedValue}
                        name="estimatedValue"
                        label="ESTIMATED VALUE"
                        help="Reference value for the artwork; not the starting bid."
                      />
                      <div className="hs-seller-form-actions">
                        <button className="hs-seller-btn" type="submit">
                          {busy ? "PUBLISHING…" : "PUBLISH LOT"}
                          <span aria-hidden="true">↗</span>
                        </button>
                      </div>
                    </fieldset>
                    {error && (
                      <p className="hs-seller-error" role="alert">
                        {error}
                      </p>
                    )}
                  </form>
                  <p className="hs-seller-notice hs-seller-local-note">
                    This publishes an auction with your selected start option.
                    Amounts are in USD; deposits and settlement use simulated
                    funds.
                  </p>
                </section>
              </div>
            </>
          ) : (
            <section aria-labelledby="seller-search-title">
              <div className="hs-seller-subheading hs-seller-search-head">
                <div>
                  <h3
                    className="hs-seller-section-title"
                    id="seller-search-title"
                  >
                    01 / SELECT AN ARTWORK
                  </h3>
                  <p className="hs-seller-notice">
                    Explore public-domain works from the Cleveland Museum of
                    Art. Only works with images are shown.
                  </p>
                </div>
                <span className="hs-seller-source-tag">
                  CLEVELAND / OPEN ACCESS
                </span>
              </div>
              <form
                className="hs-seller-search-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void search(1, { q: query, type: artworkType });
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
                      placeholder="e.g. Claude Monet"
                      autoComplete="off"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      maxLength={100}
                    />
                  </div>
                  <div className="hs-seller-fieldset">
                    <label
                      className="hs-seller-field"
                      htmlFor="catalog-artwork-type"
                    >
                      ARTWORK TYPE
                    </label>
                    <select
                      id="catalog-artwork-type"
                      className="hs-seller-input hs-seller-select"
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
                  </div>
                  <button
                    className="hs-seller-btn"
                    disabled={busy || (!query.trim() && !artworkType)}
                    type="submit"
                  >
                    {busy ? (
                      "SEARCHING…"
                    ) : (
                      <>
                        SEARCH <span aria-hidden="true">↗</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="hs-seller-field-hint">
                  Search by artwork/artist, select a type, or combine both
                  filters.
                </p>
              </form>
              <div
                role="status"
                aria-live="polite"
                className="hs-seller-search-meta"
              >
                {busy ? "Searching the collection…" : ""}
              </div>
              {!results && !busy && !error && (
                <div className="hs-seller-empty hs-seller-result-empty">
                  <span>THE COLLECTION</span>
                  <p>
                    Search by artwork / artist or choose an artwork type to
                    explore the collection.
                  </p>
                </div>
              )}
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
                              loading="lazy"
                              onError={(event) => {
                                const button =
                                  event.currentTarget.closest("button");
                                if (button) {
                                  button.disabled = true;
                                  button.classList.add("image-error");
                                }
                                event.currentTarget.alt = "Image unavailable";
                              }}
                            />
                          </div>
                          <div className="hs-seller-art-info">
                            <span className="hs-seller-art-id">
                              CMA / {art.articArtworkId}
                            </span>
                            <h4>{art.name}</h4>
                            <p>
                              {art.artistDisplay}
                              {art.dateDisplay && ` · ${art.dateDisplay}`}
                            </p>
                            <span className="hs-seller-art-action">
                              SELECT WORK <span aria-hidden="true">↗</span>
                            </span>
                          </div>
                        </button>
                      ))}
                  </div>
                  {!results.items.some(
                    (art) => art.imageUrl && art.isPublicDomain === true,
                  ) && <p>No artworks found. Try another search.</p>}
                  {results.total > 9 && (
                    <div className="hs-seller-pagination">
                      <span>
                        PAGE {results.page} OF {Math.ceil(results.total / 9)} ·{" "}
                        {results.total.toLocaleString("en-US")} WORKS
                      </span>
                      <div>
                        <button
                          type="button"
                          aria-label="PREVIOUS"
                          className="hs-seller-btn ghost"
                          disabled={busy || results.page <= 1}
                          onClick={() => void search(results.page - 1)}
                        >
                          ← PREVIOUS
                        </button>
                        <button
                          type="button"
                          aria-label="NEXT"
                          className="hs-seller-btn ghost"
                          disabled={
                            busy ||
                            results.page >= 100 ||
                            results.page * 9 >= results.total
                          }
                          onClick={() => void search(results.page + 1)}
                        >
                          NEXT →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
