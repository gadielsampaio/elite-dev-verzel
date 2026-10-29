import { io } from "socket.io-client";
import { apiBaseUrl } from "./config";

const REFRESH_BATCH_DELAY_MS = 100;
const SUBSCRIPTION_TIMEOUT_MS = 5000;
const FALLBACK_INTERVAL_MS = 10000;

export type LiveRefreshListener = {
  lotId?: string;
  refresh: () => void;
  onConnectionChange: (ready: boolean) => void;
};

// One connection per session, shared by all mounted queries. Tokens never enter URLs.
const feedsByToken = new Map<string, ReturnType<typeof createLiveFeed>>();

function createLiveFeed(token?: string) {
  const listeners = new Set<LiveRefreshListener>();
  const base = new URL(
    import.meta.env.VITE_SOCKET_BASE_URL || apiBaseUrl || "/",
    location.origin,
  );
  const socket = io(`${base.origin}/auctions`, {
    path: `${base.pathname.replace(/\/$/, "")}/socket.io`,
    transports: ["websocket"],
    autoConnect: false,
    forceNew: true,
  });
  let collectionReady = false;
  let accountReady = !token;
  let disposed = false;
  let connectionVersion = 0;
  let subscriptionInFlight = false;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  const pendingListeners = new Set<LiveRefreshListener>();
  const isReady = () => collectionReady && accountReady;
  const notifyStatus = () => listeners.forEach((listener) => listener.onConnectionChange(isReady()));

  const queueRefresh = (lotId?: string) => {
    for (const listener of listeners) {
      if (!lotId || !listener.lotId || listener.lotId === lotId) {
        pendingListeners.add(listener);
      }
    }

    if (refreshTimer || disposed) return;
    refreshTimer = setTimeout(() => {
      refreshTimer = undefined;
      const batch = [...pendingListeners];
      pendingListeners.clear();
      if (disposed) return;
      for (const listener of batch) {
        if (listeners.has(listener)) listener.refresh();
      }
    }, REFRESH_BATCH_DELAY_MS);
  };

  const join = async () => {
    if (!socket.connected || subscriptionInFlight || disposed) return;
    subscriptionInFlight = true;
    const generation = connectionVersion;
    try {
      const reply = await socket
        .timeout(SUBSCRIPTION_TIMEOUT_MS)
        .emitWithAck("collection.subscribe");
      if (disposed || generation !== connectionVersion || !socket.connected) return;
      collectionReady = reply?.ok === true;
      if (token) {
        const account = await socket
          .timeout(SUBSCRIPTION_TIMEOUT_MS)
          .emitWithAck("account.subscribe", { token });
        if (disposed || generation !== connectionVersion || !socket.connected) return;
        accountReady = account?.ok === true;
      }
      notifyStatus();
      // Initial HTTP is immediate; this resync closes the fetch/subscription gap.
      queueRefresh();
    } catch {
      if (generation !== connectionVersion) return;
      collectionReady = false;
      accountReady = !token;
      notifyStatus();
    } finally {
      if (generation === connectionVersion) subscriptionInFlight = false;
    }
  };

  socket.on("connect", () => {
    connectionVersion++;
    subscriptionInFlight = false;
    void join();
  });
  socket.on("collection.changed", (event: { lotId?: string } | null) => {
    if (typeof event?.lotId === "string") queueRefresh(event.lotId);
  });
  socket.on("account.changed", () => queueRefresh());
  socket.on("account.expired", () => {
    accountReady = false;
    notifyStatus();
    queueRefresh();
  });

  const disconnected = () => {
    connectionVersion++;
    subscriptionInFlight = false;
    collectionReady = false;
    accountReady = !token;
    notifyStatus();
  };
  socket.on("disconnect", disconnected);
  socket.on("connect_error", disconnected);

  const fallback = setInterval(() => {
    if (!navigator.onLine || document.visibilityState !== "visible" || isReady())
      return;
    queueRefresh();
    if (socket.connected) void join();
    else socket.connect();
  }, FALLBACK_INTERVAL_MS);

  const visible = () => {
    if (document.visibilityState === "visible") queueRefresh();
  };
  const online = () => {
    socket.connect();
    queueRefresh();
  };
  const offline = () => socket.disconnect();
  document.addEventListener("visibilitychange", visible);
  window.addEventListener("online", online);
  window.addEventListener("offline", offline);
  socket.connect();

  return {
    add(listener: LiveRefreshListener) {
      listeners.add(listener);
      listener.onConnectionChange(isReady());
    },
    remove(listener: LiveRefreshListener) {
      listeners.delete(listener);
      pendingListeners.delete(listener);
    },
    get size() {
      return listeners.size;
    },
    stop() {
      disposed = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      clearInterval(fallback);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}

export function subscribeLiveRefresh(listener: LiveRefreshListener, token?: string) {
  const key = token ?? "";
  let feed = feedsByToken.get(key);
  if (!feed) {
    feed = createLiveFeed(token);
    feedsByToken.set(key, feed);
  }

  feed.add(listener);
  return () => {
    feed.remove(listener);
    if (feed.size) return;

    feed.stop();
    feedsByToken.delete(key);
  };
}
