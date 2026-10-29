import { apiBaseUrl } from "./config";
import { ApiError } from "./errors";

let renewSession: ((token: string) => Promise<string>) | undefined;

export function setSessionRenewal(
  handler?: (token: string) => Promise<string>,
) {
  renewSession = handler;
}

export async function api<T>(
  path: string,
  token?: string,
  init: RequestInit = {},
  retrySession = true,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: path.startsWith("/auth/") ? "include" : "omit",
      headers: {
        ...(path.startsWith("/auth/") ? { "X-Session-Request": "1" } : {}),
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new Error("Cannot reach the API. Check your connection and retry.");
  }
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && token && retrySession && renewSession) {
      const renewed = await renewSession(token);
      return api<T>(path, renewed, init, false);
    }
    if (response.status === 401 && token)
      window.dispatchEvent(
        new CustomEvent("session-expired", { detail: token }),
      );

    const message = body?.message;
    throw new ApiError(
      Array.isArray(message)
        ? message.join(". ")
        : (message ?? "The request could not be completed."),
      response.status,
    );
  }

  return body as T;
}
