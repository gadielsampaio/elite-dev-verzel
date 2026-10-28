import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { apiBaseUrl } from "../../api";

type Listener = {
  lotId?: string;
  refresh: () => void;
  status: (ready: boolean) => void;
};
// One connection per session, shared by all mounted queries. Tokens never enter URLs.
const feeds = new Map<string, ReturnType<typeof createFeed>>();
function createFeed(token?: string) {
  const listeners = new Set<Listener>();
  const base = new URL(import.meta.env.VITE_SOCKET_BASE_URL || apiBaseUrl || "/", location.origin);
  const socket = io(`${base.origin}/auctions`, {
    path: `${base.pathname.replace(/\/$/, "")}/socket.io`,
    transports: ["websocket"],
    autoConnect: false,
    forceNew: true,
  });
  let publicReady = false,
    accountReady = !token,
    stopped = false,
    version = 0,
    joining = false;
  let queued: ReturnType<typeof setTimeout> | undefined;
  const pending = new Set<Listener>();
  const ready = () => publicReady && accountReady;
  const status = () => listeners.forEach((l) => l.status(ready()));
  const refresh = (lotId?: string) => {
    for (const l of listeners)
      if (!lotId || !l.lotId || l.lotId === lotId) pending.add(l);
    if (queued || stopped) return;
    queued = setTimeout(() => {
      queued = undefined;
      const batch = [...pending];
      pending.clear();
      if (!stopped)
        batch.forEach((l) => {
          if (listeners.has(l)) l.refresh();
        });
    }, 100);
  };
  const join = async () => {
    if (!socket.connected || joining || stopped) return;
    joining = true;
    const generation = version;
    try {
      const reply = await socket
        .timeout(5000)
        .emitWithAck("collection.subscribe");
      if (stopped || generation !== version || !socket.connected) return;
      publicReady = reply?.ok === true;
      if (token) {
        const account = await socket
          .timeout(5000)
          .emitWithAck("account.subscribe", { token });
        if (stopped || generation !== version || !socket.connected) return;
        accountReady = account?.ok === true;
      }
      status();
      // Initial HTTP is immediate; this resync closes the fetch/subscription gap.
      refresh();
    } catch {
      if (generation === version) {
        publicReady = false;
        accountReady = !token;
        status();
      }
    } finally {
      if (generation === version) joining = false;
    }
  };
  socket.on("connect", () => {
    version++;
    joining = false;
    void join();
  });
  socket.on("collection.changed", (event: { lotId?: string } | null) => {
    if (typeof event?.lotId === "string") refresh(event.lotId);
  });
  socket.on("account.changed", () => refresh());
  socket.on("account.expired", () => {
    accountReady = false;
    status();
    refresh();
  });
  const disconnected = () => {
    version++;
    joining = false;
    publicReady = false;
    accountReady = !token;
    status();
  };
  socket.on("disconnect", disconnected);
  socket.on("connect_error", disconnected);
  const fallback = setInterval(() => {
    if (document.visibilityState !== "visible" || ready()) return;
    refresh();
    if (socket.connected) void join();
    else socket.connect();
  }, 10000);
  const visible = () => {
    if (document.visibilityState === "visible") refresh();
  };
  const online = () => {
    socket.connect();
    refresh();
  };
  document.addEventListener("visibilitychange", visible);
  window.addEventListener("online", online);
  socket.connect();
  return {
    add(listener: Listener) {
      listeners.add(listener);
      listener.status(ready());
    },
    remove(listener: Listener) {
      listeners.delete(listener);
      pending.delete(listener);
    },
    get size() {
      return listeners.size;
    },
    stop() {
      stopped = true;
      if (queued) clearTimeout(queued);
      clearInterval(fallback);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("online", online);
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}

export function useLiveRefresh(
  refresh: () => void,
  token?: string,
  lotId?: string,
  enabled = true,
) {
  const latest = useRef(refresh);
  latest.current = refresh;
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }
    const key = token ?? "";
    let feed = feeds.get(key);
    if (!feed) {
      feed = createFeed(token);
      feeds.set(key, feed);
    }
    const listener: Listener = {
      lotId,
      refresh: () => latest.current(),
      status: setConnected,
    };
    feed.add(listener);
    return () => {
      feed.remove(listener);
      if (!feed.size) {
        feed.stop();
        feeds.delete(key);
      }
    };
  }, [enabled, token, lotId]);
  return connected;
}
