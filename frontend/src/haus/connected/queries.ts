import { useEffect, useState } from "react";
import { api, message, ApiError } from "../../api";
export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};
export type BidSummary = {
  lotId: string;
  status: "open" | "scheduled" | "closed";
  serverTime: string;
  endTime: string;
  currentBid: string | null;
  minimumNextBid: string | null;
  currency: string;
  startingBid: string;
  items: {
    id: string;
    bidderAlias: string;
    bidderLabel?: string;
    amount: string;
    createdAt: string;
    isActive: boolean;
  }[];
  total: number;
  page: number;
  limit: number;
};
// A query never substitutes fixtures after an error; abort and key checks prevent stale renders.
export function useApiQuery<T>(
  path: string | null,
  token?: string,
  keepPreviousData = false,
) {
  const [revision, setRevision] = useState(0);
  const resource = `${path}|${token || ""}`;
  const key = `${resource}|${revision}`;
  const [state, setState] = useState<{
    key: string;
    resource: string;
    data: T | null;
    error: string;
  }>({ key: "", resource: "", data: null, error: "" });
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    api<T>(path, token, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ key, resource, data, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState((previous) => ({
            key,
            resource,
            data:
              keepPreviousData &&
              previous.resource === resource &&
              !(error instanceof ApiError && [404, 410].includes(error.status))
                ? previous.data
                : null,
            error: message(error),
          }));
      });
    return () => controller.abort();
  }, [path, token, key, resource, keepPreviousData]);
  const current = state.key === key;
  return {
    data:
      current || (keepPreviousData && state.resource === resource)
        ? state.data
        : null,
    error: current ? state.error : "",
    loading: !!path && (!current || (!state.data && !state.error)),
    refresh: () => setRevision((n) => n + 1),
  };
}
// Decimal strings stay exact, including amounts beyond Number.MAX_SAFE_INTEGER.
export function dollars(value: string, currency = "USD") {
  const [whole, fraction = ""] = value.split(".");
  return `${currency === "USD" ? "$" : currency + " "}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction.padEnd(2, "0")}`;
}
