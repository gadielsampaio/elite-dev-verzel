import { useEffect, useRef, useState } from "react";
import { setSessionRenewal } from "../api/client";
import { ApiError } from "../api/errors";
import { message } from "../utils/errors";
import type { Session, SessionContextValue } from "../types/session";
import {
  LEGACY_SESSION_STORAGE_KEY,
  SESSION_BROADCAST_CHANNEL,
  SESSION_EXPIRED_NOTICE,
  SESSION_REFRESH_LEAD_MS,
  SESSION_RETRY_DELAY_MS,
} from "./constants";
import {
  isSessionRejection,
  loadSessionProfile,
  readTokenClaims,
  refreshAccessToken,
  signIn,
  signOut,
  tokenExpirationMs,
} from "./sessionService";

export function useSessionController(restoreSession: boolean): SessionContextValue {
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState("");
  const [restoring, setRestoring] = useState(restoreSession);
  const [restoreError, setRestoreError] = useState("");
  const [warning, setWarning] = useState("");
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const activeSession = useRef<Session | null>(null);
  const sessionGeneration = useRef(0);
  const authChannel = useRef<BroadcastChannel | null>(null);
  const pendingRenewal = useRef<{
    token: string;
    sessionGeneration: number;
    promise: Promise<string>;
  } | null>(null);

  function clearSession(text = "") {
    sessionGeneration.current++;
    activeSession.current = null;
    setSession(null);
    setNotice(text);
    setRestoring(false);
    setRestoreError("");
    setWarning("");
  }

  function acceptSession(value: Session) {
    activeSession.current = value;
    setSession(value);
    setWarning("");
  }

  function renewSession(oldToken: string): Promise<string> {
    if (
      pendingRenewal.current?.token === oldToken &&
      pendingRenewal.current.sessionGeneration === sessionGeneration.current
    )
      return pendingRenewal.current.promise;
    const pending = {
      token: oldToken,
      sessionGeneration: sessionGeneration.current,
      promise: performSessionRenewal(oldToken),
    };
    pendingRenewal.current = pending;
    return pending.promise.finally(() => {
      if (pendingRenewal.current === pending) pendingRenewal.current = null;
    });
  }

  async function performSessionRenewal(oldToken: string) {
    const current = sessionGeneration.current;
    if (
      activeSession.current &&
      activeSession.current.token !== oldToken &&
      tokenExpirationMs(activeSession.current.token) > Date.now()
    ) {
      if (readTokenClaims(oldToken).sub !== activeSession.current.user.id)
        throw new ApiError(SESSION_EXPIRED_NOTICE, 401);
      return activeSession.current.token;
    }
    try {
      const value = await loadSessionProfile(await refreshAccessToken());
      if (current !== sessionGeneration.current)
        throw new ApiError("Session changed", 401);
      // Never replay an action under a different account after another tab logs in.
      if (value.user.id !== readTokenClaims(oldToken).sub)
        throw new ApiError(SESSION_EXPIRED_NOTICE, 401);
      acceptSession(value);
      return value.token;
    } catch (error) {
      if (
        current === sessionGeneration.current &&
        isSessionRejection(error)
      )
        clearSession(SESSION_EXPIRED_NOTICE);
      throw error;
    }
  }

  useEffect(() => {
    // Migrate from the old access-token persistence; secrets now stay out of JS storage.
    try {
      sessionStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
    } catch {
      /* Restricted browser storage. */
    }
    setSessionRenewal(renewSession);
    const expire = (event: Event) => {
      if ((event as CustomEvent<string>).detail === activeSession.current?.token)
        clearSession(SESSION_EXPIRED_NOTICE);
    };
    window.addEventListener("session-expired", expire);
    if (typeof BroadcastChannel !== "undefined") {
      authChannel.current = new BroadcastChannel(SESSION_BROADCAST_CHANNEL);
      authChannel.current.onmessage = (event) => {
        if (event.data === "logout") clearSession();
      };
    }
    return () => {
      setSessionRenewal(undefined);
      window.removeEventListener("session-expired", expire);
      authChannel.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!restoreSession) return;
    const current = ++sessionGeneration.current;
    let stopped = false;
    setRestoring(true);
    setRestoreError("");
    let refreshed = false;
    refreshAccessToken()
      .then((token) => {
        refreshed = true;
        return loadSessionProfile(token);
      })
      .then((value) => {
        if (stopped || current !== sessionGeneration.current) return;
        acceptSession(value);
        setRestoring(false);
      })
      .catch((error) => {
        if (stopped || current !== sessionGeneration.current) return;
        if (isSessionRejection(error)) {
          clearSession(refreshed ? SESSION_EXPIRED_NOTICE : "");
          return;
        }

        setRestoreError(message(error));
        setRestoring(false);
      });
    return () => {
      stopped = true;
    };
  }, [restoreAttempt, restoreSession]);

  useEffect(() => {
    if (!session) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const attempt = async () => {
      try {
        await renewSession(session.token);
      } catch (error) {
        if (stopped || isSessionRejection(error)) return;

        setWarning("Session renewal unavailable. Retrying when the API reconnects.");
        timer = setTimeout(() => void attempt(), SESSION_RETRY_DELAY_MS);
      }
    };
    timer = setTimeout(
      () => void attempt(),
      Math.max(0, tokenExpirationMs(session.token) - Date.now() - SESSION_REFRESH_LEAD_MS),
    );
    const resume = () => {
      if (
        document.visibilityState === "visible" &&
        tokenExpirationMs(session.token) - Date.now() < SESSION_REFRESH_LEAD_MS
      )
        void attempt();
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [session]);

  async function login(email: string, password: string) {
    const current = ++sessionGeneration.current;
    const value = await signIn(email, password);
    if (current !== sessionGeneration.current) return;
    acceptSession(value);
    setNotice("");
  }

  async function logout() {
    sessionGeneration.current++;
    try {
      await signOut();
      clearSession();
      authChannel.current?.postMessage("logout");
    } catch {
      setWarning(
        "Could not sign out on the server. Check your connection and try again.",
      );
    }
  }

  return {
    session,
    notice,
    restoring,
    restoreError,
    warning,
    login,
    logout,
    retryRestore: () => setRestoreAttempt((attempt) => attempt + 1),
  };
}
