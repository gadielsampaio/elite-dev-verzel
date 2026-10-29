import { useTranslation } from "@/hooks/useTranslation";
import { useArtworkViewer } from "../hooks/useArtworkViewer";
import { useState } from "react";
import { Skeleton } from "./ui/skeleton";
export function ArtworkScene({
  lot,
  collectionLabel,
}: {
  lot: {
    title: string;
    image: string;
    artist: string;
    year: string;
    provider?: string;
  };
  collectionLabel?: string;
}) {
  const { t } = useTranslation();
  const [imageLoaded, setImageLoaded] = useState(false);
  const {
    scene,
    figure,
    zoom,
    setZoom,
    resetView,
    imageFailed,
    setImageFailed,
    dragged,
  } = useArtworkViewer(lot.image);
  return (
    <div
      className={`hs-immersive-scene${zoom > 1 ? " is-zoomed" : ""}`}
      id="lot-scene"
      ref={scene}
      tabIndex={0}
      role="region"
      aria-label={t("Artwork viewer")}
      aria-describedby="artwork-navigation-help"
      onClickCapture={(e) => {
        if (dragged.current) {
          dragged.current = false;
          e.stopPropagation();
        }
      }}
    >
      <div className="hs-art-figure" id="lot-figure" ref={figure}>
        {lot.image && !imageFailed && !imageLoaded && (
          <Skeleton
            role="status"
            aria-label={t("Loading artwork…")}
            aria-busy="true"
            className="rounded-none"
            style={{ position: "absolute", inset: "4% 7%" }}
          />
        )}
        {lot.image && !imageFailed ? (
          <img
            alt={t("{title} by {artist}", {
              title: lot.title,
              artist: lot.artist,
            })}
            draggable="false"
            id="lot-img"
            src={lot.image}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <p className="hs-p-mini">{t("Image unavailable")}</p>
        )}
        <div className="hs-floating-copy">
          <p className="hs-floating-collection">
            {collectionLabel ||
              `THE ${lot.provider === "cleveland" ? "CLEVELAND" : "CHICAGO"} COLLECTION`}{" "}
            {t("/ ARTWORK")}{" "}
          </p>
          <h2 className="hs-p-title" id="lot-title">
            {lot.title}
          </h2>
          <p className="hs-p-artist">
            {lot.artist} / {lot.year}
          </p>
        </div>
      </div>
      <p className="hs-immersive-instructions" id="artwork-navigation-help">
        {t("MOVE TO INSPECT")} <span aria-hidden="true">·</span>{" "}
        {t("SCROLL TO ZOOM")} <span aria-hidden="true">·</span>{" "}
        {t("DRAG OR USE ARROW KEYS WHEN ZOOMED")}{" "}
      </p>
      <div aria-label={t("Artwork zoom controls")} className="hs-zoom-tools">
        <button
          aria-label={t("Zoom out")}
          type="button"
          onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
        >
          −
        </button>
        <button aria-label={t("Reset view")} type="button" onClick={resetView}>
          ↺
        </button>
        <output aria-live="off">{Math.round(zoom * 100)}%</output>
        <button
          aria-label={t("Zoom in")}
          type="button"
          onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
        >
          +
        </button>
      </div>
    </div>
  );
}
