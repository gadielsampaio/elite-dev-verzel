import { useEffect, useState } from "react";

// Use Cleveland's highest-resolution browser-ready JPEG.
export function useRoomImage(web?: string | null, print?: string | null) {
  const high = print;
  const key = JSON.stringify([web, high]);
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(
    null,
  );
  useEffect(() => {
    if (!high || high === web) return;
    let stopped = false;
    const preview = new Image();
    const detail = new Image();
    detail.decoding = "async";
    detail.fetchPriority = "low";
    const upgrade = async () => {
      if (stopped) return;
      detail.src = high;
      try {
        await detail.decode();
        if (!stopped) setLoaded({ key, url: high });
      } catch {
        // Keep the web image when the high-resolution image is unavailable.
      }
    };
    preview.onload = preview.onerror = () => void upgrade();
    if (web) preview.src = web;
    else void upgrade();
    return () => {
      stopped = true;
      preview.onload = preview.onerror = null;
    };
  }, [key, web, high]);
  return loaded?.key === key ? loaded.url : web || "";
}
