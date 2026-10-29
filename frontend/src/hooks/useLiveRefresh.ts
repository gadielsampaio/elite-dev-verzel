import { useEffect, useRef, useState } from "react";
import { subscribeLiveRefresh } from "../api/liveFeed";

export function useLiveRefresh(
  refresh: () => void,
  token?: string,
  lotId?: string,
  enabled = true,
) {
  const latestRefresh = useRef(refresh);
  latestRefresh.current = refresh;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    return subscribeLiveRefresh({
      lotId,
      refresh: () => latestRefresh.current(),
      onConnectionChange: setConnected,
    }, token);
  }, [enabled, token, lotId]);

  return connected;
}
