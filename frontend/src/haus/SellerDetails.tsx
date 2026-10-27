import { useEffect, useState, type FormEvent } from "react";
import { catalogBase, normalizeArtwork } from "./catalog";
import { MoneyInput } from "./shared";
import type { CatalogArtwork } from "./types";
export type Draft = {
  title: string;
  start: string;
  end: string;
  opening: number;
  increment: number;
  estimated: number;
};
export function initialDraft(): Draft {
  const local = (n: number) => {
    const d = new Date(Date.now() + n);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
  return {
    title: "",
    start: local(3600000),
    end: local(25 * 3600000),
    opening: 0,
    increment: 0,
    estimated: 0,
  };
}
export function SellerDetails({
  art,
  draft,
  setDraft,
  back,
  publish,
}: {
  art: CatalogArtwork;
  draft: Draft;
  setDraft: (draft: Draft) => void;
  back: () => void;
  publish: (art: CatalogArtwork) => string;
}) {
  const [selected, setSelected] = useState(art),
    [loading, setLoading] = useState(art.source === "api");
  const [errors, setErrors] = useState<Record<string, string>>({}),
    [error, setError] = useState("");
  useEffect(() => {
    if (art.source !== "api") return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      setLoading(false);
    }, 10000);
    async function detail() {
      try {
        const response = await fetch(`${catalogBase}/${art.id}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = await response.json();
        const normalized = normalizeArtwork(payload.data);
        if (!controller.signal.aborted && normalized?.id === art.id)
          setSelected(normalized);
      } catch {
        /* Search metadata remains usable when detail fails. */
      } finally {
        if (!controller.signal.aborted) setLoading(false);
        clearTimeout(timer);
      }
    }
    void detail();
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [art]);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!draft.title.trim()) next.title = "Enter a lot title.";
    const start = Date.parse(draft.start),
      end = Date.parse(draft.end);
    if (!Number.isFinite(start) || start <= Date.now())
      next.start = "Choose a future start date.";
    if (!Number.isFinite(end) || end <= start)
      next.end = "End must follow the start.";
    for (const k of ["opening", "increment", "estimated"] as const)
      if (!Number.isFinite(draft[k]) || draft[k] <= 0)
        next[k] = "Enter an amount greater than zero.";
    setErrors(next);
    setError("");
    if (Object.keys(next).length)
      e.currentTarget
        .querySelector<HTMLInputElement>(`#seller-${Object.keys(next)[0]}`)
        ?.focus();
    else setError(publish(selected));
  }
  function field(key: keyof Draft, label: string, type = "text", help = "") {
    const id = `seller-${key}`;
    const props = {
      id,
      className: "hs-seller-input",
      "aria-invalid": errors[key] ? (true as const) : undefined,
      "aria-describedby": `${id}-error${help ? ` ${id}-help` : ""}`,
    };
    return (
      <div className="hs-seller-fieldset">
        <label className="hs-seller-field" htmlFor={id}>
          {label}
        </label>
        {typeof draft[key] === "number" ? (
          <MoneyInput
            {...props}
            className="hs-seller-input hs-money-input"
            value={Number(draft[key])}
            onValue={(value) => setDraft({ ...draft, [key]: value })}
          />
        ) : (
          <input
            {...props}
            type={type}
            maxLength={key === "title" ? 200 : undefined}
            value={draft[key]}
            onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
          />
        )}
        <span
          id={`${id}-error`}
          className="hs-seller-field-error"
          aria-live="polite"
        >
          {errors[key]}
        </span>
        {help && (
          <span className="hs-seller-field-hint" id={`${id}-help`}>
            {help}
          </span>
        )}
      </div>
    );
  }
  return (
    <>
      <div className="hs-seller-detail-toolbar">
        <button className="hs-seller-text-link" type="button" onClick={back}>
          ← BACK TO COLLECTION
        </button>
        <span>02 / LOT DETAILS</span>
      </div>
      <div className="hs-seller-detail-layout">
        <aside
          className="hs-seller-artwork-panel"
          aria-label="Selected artwork"
        >
          <div>
            <div className="hs-seller-artwork-display">
              <img
                src={selected.image}
                alt={selected.title}
                onError={(e) =>
                  e.currentTarget.parentElement?.classList.add("image-error")
                }
              />
            </div>
            <div className="hs-seller-artwork-caption">
              <div>
                <span className="hs-seller-art-id">
                  SELECTED ARTWORK · CMA {selected.id}
                </span>
                <h4>{selected.title}</h4>
                <p>{selected.artist}</p>
              </div>
              <button
                className="hs-seller-text-link"
                type="button"
                onClick={back}
              >
                CHANGE ↗
              </button>
            </div>
            <dl className="hs-seller-artwork-details">
              {[
                ["YEAR", selected.year || "Not listed"],
                ["MEDIUM", selected.medium || "Not listed"],
                ["TYPE", selected.artworkType || "Not listed"],
                [
                  "SOURCE",
                  selected.source === "sample"
                    ? "Cleveland / sample data"
                    : "Cleveland / open access",
                ],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="hs-seller-notice" role="status">
            {loading ? "Loading artwork details…" : ""}
          </p>
        </aside>
        <section
          className="hs-seller-form-panel"
          aria-labelledby="seller-form-title"
        >
          <h3 id="seller-form-title" className="hs-seller-section-title">
            CONFIGURE THE AUCTION
          </h3>
          <p className="hs-seller-notice">
            Artwork information is provided by the museum. Set the schedule and
            bidding conditions below.
          </p>
          <form id="seller-form" noValidate onSubmit={submit}>
            {field("title", "LOT TITLE")}
            <div className="hs-seller-form-grid">
              {field("start", "START DATE & TIME", "datetime-local")}
              {field("end", "END DATE & TIME", "datetime-local")}
            </div>
            <p className="hs-seller-field-hint hs-seller-time-hint">
              Times use your device's local time zone.
            </p>
            <div className="hs-seller-form-grid">
              {field("opening", "STARTING BID")}
              {field("increment", "MINIMUM INCREMENT")}
            </div>
            {field(
              "estimated",
              "ESTIMATED VALUE",
              "text",
              "Reference value for the artwork; not the starting bid.",
            )}
            <div className="hs-seller-form-actions">
              <button className="hs-seller-btn" type="submit">
                PUBLISH DEMO LOT <span>↗</span>
              </button>
              <div className="hs-seller-error" role="alert">
                {error}
              </div>
            </div>
          </form>
          <p className="hs-seller-notice hs-seller-local-note">
            This creates a local preview in your browser. No real auction is
            published, and no backend is called.
          </p>
        </section>
      </div>
    </>
  );
}
