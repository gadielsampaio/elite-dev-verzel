import { useEffect, useState } from "react";

// Use Cleveland's highest-resolution browser-ready JPEG.
export function useRoomImage(previewUrl?: string | null, detailUrl?: string | null) {
  const resourceKey = JSON.stringify([previewUrl, detailUrl]);
  const [loadedImage, setLoadedImage] = useState<{ resourceKey: string; url: string } | null>(
    null,
  );

  useEffect(() => {
    if (!detailUrl || detailUrl === previewUrl) return;

    let cancelled = false;
    const previewImage = new Image();
    const detailImage = new Image();
    detailImage.decoding = "async";
    detailImage.fetchPriority = "low";

    const loadDetailImage = async () => {
      if (cancelled) return;
      detailImage.src = detailUrl;
      try {
        await detailImage.decode();
        if (!cancelled) setLoadedImage({ resourceKey, url: detailUrl });
      } catch {
        // Keep the preview image when the high-resolution image is unavailable.
      }
    };

    previewImage.onload = previewImage.onerror = () => void loadDetailImage();
    if (previewUrl) previewImage.src = previewUrl;
    else void loadDetailImage();

    return () => {
      cancelled = true;
      previewImage.onload = previewImage.onerror = null;
    };
  }, [resourceKey, previewUrl, detailUrl]);

  return loadedImage?.resourceKey === resourceKey ? loadedImage.url : previewUrl || "";
}
