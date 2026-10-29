import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError, message, type Lot } from "../../api";
import { useSession } from "../../session";
import { useApiQuery } from "./queries";

export type CatalogArtwork = {
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
  items: CatalogArtwork[];
  page: number;
  total: number;
  provider: string;
};
const amountPattern = /^(?!0+(?:\.0{1,2})?$)\d{1,17}(?:\.\d{1,2})?$/;

export function localFuture(hours: number) {
  const date = new Date(Date.now() + hours * 3600000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function useSellerStudio(
  initialArtworkType = "",
  initialStartMode = "scheduled",
) {
  const { session } = useSession();
  const [tab, setTab] = useState<"lots" | "create" | "results">("lots");
  const [query, setQuery] = useState("");
  const [artworkType, setArtworkType] = useState(initialArtworkType);
  const [results, setResults] = useState<Search | null>(null);
  const [selected, setSelected] = useState<CatalogArtwork | null>(null);
  const [published, setPublished] = useState<Lot | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [startMode, setStartMode] = useState(initialStartMode);
  const [startValue, setStartValue] = useState(() => localFuture(1));
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
  async function select(artwork: CatalogArtwork) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const detail = await api<CatalogArtwork>(
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
        .querySelector<HTMLElement>(
          `[data-field="${Object.keys(errors)[0]}"], [name="${Object.keys(errors)[0]}"]:not([type="hidden"])`,
        )
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
  return {
    session,
    tab,
    setTab,
    query,
    setQuery,
    artworkType,
    setArtworkType,
    results,
    selected,
    setSelected,
    published,
    setPublished,
    cancelled,
    setCancelled,
    busy,
    error,
    setError,
    fieldErrors,
    setFieldErrors,
    startMode,
    setStartMode,
    startValue,
    setStartValue,
    uncertain,
    summary,
    search,
    select,
    publish,
    cancel,
  };
}
