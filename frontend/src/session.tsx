import { Alert, AlertDescription } from "./components/ui/alert";
import { Button } from "./components/ui/button";
import { SessionSkeleton } from "./components/SessionSkeleton";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError, message, setSessionRenewal, type User } from "./api";
type Session = { token: string; user: User };
const expiredNotice = "Your session expired. Please sign in again.";
function claims(token: string): { sub: string; exp: number } {
  const encoded = token.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/");
  if (!encoded) throw new Error("Invalid access token");
  const value = JSON.parse(atob(encoded));
  if (
    typeof value.sub !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(value.sub) ||
    !Number.isFinite(value.exp)
  )
    throw new Error("Invalid access token");
  return value;
}
async function profile(token: string): Promise<Session> {
  const { sub, exp } = claims(token);
  if (exp * 1000 <= Date.now()) throw new ApiError(expiredNotice, 401);
  const user = await api<User>(
    `/users/${encodeURIComponent(sub)}`,
    token,
    {},
    false,
  );
  if (user.id !== sub) throw new ApiError(expiredNotice, 401);
  return { token, user };
}
// Serialize cookie rotation across components and tabs. Never abort a rotation
// after sending it: its cookie response must be allowed to complete.
async function sessionLock<T>(action: () => Promise<T>) {
  if (navigator.locks)
    return navigator.locks.request("auction-refresh", action);
  return action();
}
let refreshFlight: Promise<string> | undefined;
function refreshAccess() {
  if (!refreshFlight)
    refreshFlight = sessionLock(async () => {
      const result = await api<{ accessToken: string }>(
        "/auth/refresh",
        undefined,
        { method: "POST", body: "{}" },
      );
      return result.accessToken;
    }).finally(() => {
      refreshFlight = undefined;
    });
  return refreshFlight;
}
const Context = createContext<{
  session: Session | null;
  notice: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
} | null>(null);
export function SessionProvider({
  children,
  restoreSession = true,
}: {
  children: ReactNode;
  restoreSession?: boolean;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState("");
  const [restoring, setRestoring] = useState(restoreSession);
  const [restoreError, setRestoreError] = useState("");
  const [warning, setWarning] = useState("");
  const [retry, setRetry] = useState(0);
  const active = useRef<Session | null>(null),
    generation = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const renewing = useRef<{
    token: string;
    generation: number;
    promise: Promise<string>;
  } | null>(null);
  function clear(text = "") {
    generation.current++;
    active.current = null;
    setSession(null);
    setNotice(text);
    setRestoring(false);
    setRestoreError("");
    setWarning("");
  }
  function accept(value: Session) {
    active.current = value;
    setSession(value);
    setWarning("");
  }
  function renew(oldToken: string): Promise<string> {
    if (
      renewing.current?.token === oldToken &&
      renewing.current.generation === generation.current
    )
      return renewing.current.promise;
    const pending = {
      token: oldToken,
      generation: generation.current,
      promise: performRenew(oldToken),
    };
    renewing.current = pending;
    return pending.promise.finally(() => {
      if (renewing.current === pending) renewing.current = null;
    });
  }
  async function performRenew(oldToken: string) {
    const current = generation.current;
    if (
      active.current &&
      active.current.token !== oldToken &&
      claims(active.current.token).exp * 1000 > Date.now()
    ) {
      if (claims(oldToken).sub !== active.current.user.id)
        throw new ApiError(expiredNotice, 401);
      return active.current.token;
    }
    try {
      const value = await profile(await refreshAccess());
      if (current !== generation.current)
        throw new ApiError("Session changed", 401);
      // Never replay an action under a different account after another tab logs in.
      if (value.user.id !== claims(oldToken).sub)
        throw new ApiError(expiredNotice, 401);
      accept(value);
      return value.token;
    } catch (error) {
      if (
        current === generation.current &&
        error instanceof ApiError &&
        [401, 403, 404].includes(error.status)
      )
        clear(expiredNotice);
      throw error;
    }
  }
  useEffect(() => {
    // Migrate from the old access-token persistence; secrets now stay out of JS storage.
    try {
      sessionStorage.removeItem("auction-session-token");
    } catch {
      /* Restricted browser storage. */
    }
    setSessionRenewal(renew);
    const expire = (event: Event) => {
      if ((event as CustomEvent<string>).detail === active.current?.token)
        clear(expiredNotice);
    };
    window.addEventListener("session-expired", expire);
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("auction-auth");
      channel.current.onmessage = (event) => {
        if (event.data === "logout") clear();
      };
    }
    return () => {
      setSessionRenewal(undefined);
      window.removeEventListener("session-expired", expire);
      channel.current?.close();
    };
  }, []);
  useEffect(() => {
    if (!restoreSession) return;
    const current = ++generation.current;
    let stopped = false;
    setRestoring(true);
    setRestoreError("");
    let refreshed = false;
    refreshAccess()
      .then((token) => {
        refreshed = true;
        return profile(token);
      })
      .then((value) => {
        if (stopped || current !== generation.current) return;
        accept(value);
        setRestoring(false);
      })
      .catch((error) => {
        if (stopped || current !== generation.current) return;
        if (error instanceof ApiError && [401, 403, 404].includes(error.status))
          clear(refreshed ? expiredNotice : "");
        else {
          setRestoreError(message(error));
          setRestoring(false);
        }
      });
    return () => {
      stopped = true;
    };
  }, [retry, restoreSession]);
  useEffect(() => {
    if (!session) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const attempt = async () => {
      try {
        await renew(session.token);
      } catch (error) {
        if (
          !stopped &&
          !(error instanceof ApiError && [401, 403, 404].includes(error.status))
        ) {
          setWarning(
            "Session renewal unavailable. Retrying when the API reconnects.",
          );
          timer = setTimeout(() => void attempt(), 30000);
        }
      }
    };
    timer = setTimeout(
      () => void attempt(),
      Math.max(0, claims(session.token).exp * 1000 - Date.now() - 60000),
    );
    const resume = () => {
      if (
        document.visibilityState === "visible" &&
        claims(session.token).exp * 1000 - Date.now() < 60000
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
    const current = ++generation.current;
    const result = await sessionLock(() =>
      api<{ accessToken: string }>("/auth/login", undefined, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    );
    const value = await profile(result.accessToken);
    if (current !== generation.current) return;
    accept(value);
    setNotice("");
  }
  async function logout() {
    generation.current++;
    try {
      await refreshFlight?.catch(() => {});
      await sessionLock(() =>
        api("/auth/logout", undefined, { method: "POST", body: "{}" }),
      );
      clear();
      channel.current?.postMessage("logout");
    } catch {
      setWarning(
        "Could not sign out on the server. Check your connection and try again.",
      );
    }
  }
  if (restoring) return <SessionSkeleton />;
  if (restoreError)
    return (
      <section className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6">
        <Alert variant="destructive">
          <AlertDescription>
            Could not restore your session. {restoreError}
          </AlertDescription>
        </Alert>
        <Button size="lg" onClick={() => setRetry((n) => n + 1)}>
          RETRY
        </Button>
        <Button size="lg" variant="outline" onClick={() => void logout()}>
          SIGN OUT
        </Button>
        {warning && (
          <Alert variant="destructive">
            <AlertDescription>{warning}</AlertDescription>
          </Alert>
        )}
      </section>
    );
  return (
    <Context.Provider value={{ session, notice, login, logout }}>
      {warning && (
        <Alert variant="destructive">
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      )}
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const context = useContext(Context);
  if (!context) throw new Error("Session provider missing");
  return context;
}
