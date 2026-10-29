import { useEffect, useState } from "react";
import { api } from "../api/client";
import { hasApiStatus } from "../api/errors";
import { message } from "../utils/errors";
import { useLiveRefresh } from "./useLiveRefresh";

type QueryState<T> = {
  key: string;
  resource: string;
  data: T | null;
  error: string;
};

function retainDataAfterError<T>(
  previous: QueryState<T>,
  resource: string,
  keepPreviousData: boolean,
  error: unknown,
) {
  if (!keepPreviousData || previous.resource !== resource) return null;
  if (hasApiStatus(error, [404, 410])) return null;
  return previous.data;
}

function isSameList(previousResource: string, path: string | null, token?: string) {
  if (!path) return false;

  const [previousPath, previousToken] = previousResource.split("|");
  if (previousToken !== (token || "")) return false;
  return previousPath.split("?")[0] === path.split("?")[0];
}

// A query never substitutes fixtures after an error; abort and key checks prevent stale renders.
export function useApiQuery<T>(
  path: string | null,
  token?: string,
  keepPreviousData = false,
  retainPageWhileLoading = false,
  headers?: Record<string, string>,
) {
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((previous) => previous + 1);
  const liveEnabled = !!path && /^\/(lots(?:[/?]|$)|me\/)/.test(path);
  const lotId = path?.match(/^\/lots\/([0-9a-f-]{36})(?:[/?]|$)/)?.[1];
  useLiveRefresh(refresh, token, lotId, liveEnabled);

  const headerKey = JSON.stringify(headers ?? {});
  const resource = `${path}|${token || ""}|${headerKey}`;
  const key = `${resource}|${revision}`;
  const [state, setState] = useState<QueryState<T>>({
    key: "", resource: "", data: null, error: "",
  });

  useEffect(() => {
    if (!path) return;

    const controller = new AbortController();
    api<T>(path, token, { signal: controller.signal, headers: JSON.parse(headerKey) })
      .then((data) => {
        if (controller.signal.aborted) return;
        setState({ key, resource, data, error: "" });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState((previous) => ({
          key,
          resource,
          data: retainDataAfterError(previous, resource, keepPreviousData, error),
          error: message(error),
        }));
      });

    return () => controller.abort();
  }, [path, token, key, resource, keepPreviousData, headerKey]);

  const isCurrentRevision = state.key === key;
  const isCurrentResource = state.resource === resource;
  const retainList = retainPageWhileLoading && isSameList(state.resource, path, token);

  return {
    data: isCurrentRevision || isCurrentResource || retainList ? state.data : null,
    error: isCurrentRevision ? state.error : "",
    loading: !!path && (!isCurrentResource || (!state.data && !state.error)),
    refresh,
  };
}
