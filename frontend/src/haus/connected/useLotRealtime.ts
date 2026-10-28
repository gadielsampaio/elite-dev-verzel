import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { apiBaseUrl } from "../../api";

export function useLotRealtime(lotId: string, refresh: () => void) {
  const latestRefresh = useRef(refresh);
  latestRefresh.current = refresh;
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const base = new URL(apiBaseUrl || "/", location.origin);
    const socket = io(`${base.origin}/auctions`, {
      path: `${base.pathname.replace(/\/$/, "")}/socket.io`,
      transports: ["websocket"],
      autoConnect: false,
    });
    let stopped = false,
      subscribed = false,
      subscribing = false;
    let connectionVersion = 0;
    let queued: ReturnType<typeof setTimeout> | undefined;
    const resync = () => {
      if (stopped || queued) return;
      queued = setTimeout(() => {
        queued = undefined;
        if (!stopped) latestRefresh.current();
      }, 100);
    };
    const subscribe = () => {
      if (subscribing || !socket.connected) return;
      subscribing = true;
      const version = connectionVersion;
      socket
        .timeout(5000)
        .emit(
          "lot.subscribe",
          { lotId },
          (error: Error | null, reply?: { ok?: boolean; lotId?: string }) => {
            if (stopped || !socket.connected || version !== connectionVersion)
              return;
            subscribing = false;
            subscribed = !error && reply?.ok === true && reply.lotId === lotId;
            setConnected(subscribed);
            // Join first, then re-read HTTP: covers events missed while disconnected.
            if (subscribed) resync();
          },
        );
    };
    socket.on("connect", () => {
      connectionVersion++;
      subscribe();
    });
    socket.on("lot.changed", (event: { lotId?: string } | null) => {
      if (event?.lotId === lotId) resync();
    });
    const disconnected = () => {
      connectionVersion++;
      subscribed = false;
      subscribing = false;
      setConnected(false);
    };
    socket.on("disconnect", disconnected);
    socket.on("connect_error", disconnected);
    socket.connect();
    // Best-effort signals are not an event log. HTTP also covers dropped events
    // and keeps the room usable while WebSocket transport is unavailable.
    let ticks = 0;
    const fallback = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (!subscribed || ++ticks % 3 === 0) resync();
      if (!subscribed) subscribe();
    }, 10000);
    const visible = () => {
      if (document.visibilityState === "visible") resync();
    };
    const online = () => {
      socket.connect();
      resync();
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", online);
    return () => {
      stopped = true;
      if (queued) clearTimeout(queued);
      clearInterval(fallback);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("online", online);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [lotId]);
  return connected;
}
