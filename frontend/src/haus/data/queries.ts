import { useLiveRefresh } from "./useLiveRefresh";
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
  retainPageWhileLoading = false,
) {
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((n) => n + 1);
  const live = !!path && /^\/(lots(?:[/?]|$)|me\/)/.test(path);
  const lotId = path?.match(/^\/lots\/([0-9a-f-]{36})(?:[/?]|$)/)?.[1];
  useLiveRefresh(refresh, token, lotId, live);
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
  const [previousPath, previousToken] = state.resource.split("|");
  const sameList =
    retainPageWhileLoading &&
    !!path &&
    previousToken === (token || "") &&
    previousPath.split("?")[0] === path.split("?")[0];
  return {
    data:
      current || state.resource === resource || sameList ? state.data : null,
    error: current ? state.error : "",
    loading:
      !!path && (state.resource !== resource || (!state.data && !state.error)),
    refresh,
  };
}
// Decimal strings stay exact, including amounts beyond Number.MAX_SAFE_INTEGER.
export function dollars(value: string, currency = "USD") {
  const [whole, fraction = ""] = value.split(".");
  return `${currency === "USD" ? "$" : currency + " "}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction.padEnd(2, "0")}`;
}
