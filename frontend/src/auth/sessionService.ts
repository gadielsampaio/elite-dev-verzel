import { api } from "../api/client";
import { ApiError } from "../api/errors";
import { MILLISECONDS_PER_SECOND } from "../constants/time";
import type { Session } from "../types/session";
import type { User } from "../types/user";
import { SESSION_EXPIRED_NOTICE, SESSION_REFRESH_LOCK } from "./constants";

export function readTokenClaims(token: string): { sub: string; exp: number } {
  const encoded = token.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/");
  if (!encoded) throw new Error("Invalid access token");

  const value = JSON.parse(atob(encoded));
  if (
    typeof value.sub !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(value.sub) ||
    !Number.isFinite(value.exp)
  ) {
    throw new Error("Invalid access token");
  }

  return value;
}

export function tokenExpirationMs(token: string) {
  return readTokenClaims(token).exp * MILLISECONDS_PER_SECOND;
}

export function isSessionRejection(error: unknown) {
  return error instanceof ApiError && [401, 403, 404].includes(error.status);
}

export async function loadSessionProfile(token: string): Promise<Session> {
  const { sub, exp } = readTokenClaims(token);
  if (exp * MILLISECONDS_PER_SECOND <= Date.now()) {
    throw new ApiError(SESSION_EXPIRED_NOTICE, 401);
  }

  const user = await api<User>(`/users/${encodeURIComponent(sub)}`, token, {}, false);
  if (user.id !== sub) throw new ApiError(SESSION_EXPIRED_NOTICE, 401);

  return { token, user };
}

// Serialize cookie rotation across components and tabs. Never abort a sent rotation.
async function withSessionLock<T>(action: () => Promise<T>) {
  if (navigator.locks) return navigator.locks.request(SESSION_REFRESH_LOCK, action);
  return action();
}

let refreshInFlight: Promise<string> | undefined;

export function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = withSessionLock(async () => {
    const result = await api<{ accessToken: string }>("/auth/refresh", undefined, {
      method: "POST",
      body: "{}",
    });
    return result.accessToken;
  }).finally(() => {
    refreshInFlight = undefined;
  });

  return refreshInFlight;
}

export async function signIn(email: string, password: string) {
  const result = await withSessionLock(() =>
    api<{ accessToken: string }>("/auth/login", undefined, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  );
  return loadSessionProfile(result.accessToken);
}

export async function signOut() {
  await refreshInFlight?.catch(() => {});
  await withSessionLock(() =>
    api("/auth/logout", undefined, { method: "POST", body: "{}" }),
  );
}
