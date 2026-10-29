import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { ApiError } from "../api/errors";
import { message } from "../utils/errors";
import type { Lot } from "../types/lot";
import type { CatalogArtwork, CatalogSearchResult } from "../types/catalog";
import type { SellerSummary } from "../types/seller";
import { searchCatalog } from "../api/catalog";
import { cancelLot } from "../api/lots";
import { futureLocalDateTime } from "../utils/time";
import { focusFirstInvalidField, readLotPublication } from "../utils/lotPublication";
import { useSession } from "./useSession";
import { useApiQuery } from "./useApiQuery";

export function useSellerStudio(
  initialArtworkType = "",
  initialStartMode = "scheduled",
) {
  const { session } = useSession();
  const [tab, setTab] = useState<"lots" | "create" | "results">("lots");
  const [query, setQuery] = useState("");
  const [artworkType, setArtworkType] = useState(initialArtworkType);
  const [results, setResults] = useState<CatalogSearchResult | null>(null);
  const [selected, setSelected] = useState<CatalogArtwork | null>(null);
  const [published, setPublished] = useState<Lot | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [startMode, setStartMode] = useState(initialStartMode);
  const [startValue, setStartValue] = useState(() => futureLocalDateTime(1));
  const [uncertain, setUncertain] = useState(false);
  const mutationInFlight = useRef(false);
  const searchController = useRef<AbortController | null>(null);
  const lastSearch = useRef({ q: "", type: "" });

  useEffect(() => () => searchController.current?.abort(), []);

  const summary = useApiQuery<SellerSummary>(
    session?.user.role === "auctioneer" ? "/me/auction-summary" : null,
    session?.token,
  );

  async function search(page = 1, filters = lastSearch.current) {
    const q = filters.q.trim();
    const type = filters.type;
    if (!q && !type) return;

    searchController.current?.abort();
    const request = new AbortController();
    searchController.current = request;
    setBusy(true);
    setError("");
    setResults(null);
    lastSearch.current = { q, type };

    try {
      const result = await searchCatalog(page, { q, type }, request.signal);
      if (!request.signal.aborted) setResults(result);
    } catch (e) {
      if (!request.signal.aborted) setError(message(e));
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }

  async function select(artwork: CatalogArtwork) {
    if (mutationInFlight.current) return;

    mutationInFlight.current = true;
    setBusy(true);
    setError("");

    try {
      const detail = await api<CatalogArtwork>(
        `/catalog/artworks/${artwork.articArtworkId}`,
      );
      if (!detail.imageUrl || detail.isPublicDomain !== true) {
        throw new Error("Choose a public-domain artwork with an image.");
      }

      setSelected(detail);
    } catch (e) {
      setError(message(e));
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !selected || mutationInFlight.current || uncertain) return;

    const { errors, payload } = readLotPublication(new FormData(event.currentTarget), startMode);
    setFieldErrors(errors);
    setError("");
    if (!payload) {
      focusFirstInvalidField(event.currentTarget, errors);
      return;
    }

    mutationInFlight.current = true;
    setBusy(true);
    setError("");

    try {
      const result = await api<Lot>("/lots", session.token, {
        method: "POST",
        body: JSON.stringify({ ...payload, artworkId: selected.articArtworkId }),
      });
      setPublished(result);
      summary.refresh();
    } catch (e) {
      if (!(e instanceof ApiError) || e.status >= 500) {
        setUncertain(true);
        setError(
          "Publication was not confirmed. Check MY LOTS before creating another lot; the request may have succeeded.",
        );
        return;
      }

      setError(message(e));
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  }

  async function cancel() {
    if (!session || !published || mutationInFlight.current) return;

    mutationInFlight.current = true;
    setBusy(true);
    setError("");

    try {
      await cancelLot(published.id, session.token);
      setCancelled(true);
      summary.refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      mutationInFlight.current = false;
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
