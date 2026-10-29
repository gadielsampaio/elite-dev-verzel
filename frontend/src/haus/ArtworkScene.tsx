import { useArtworkViewer } from "./useArtworkViewer";
import { useState } from "react";
import { Skeleton } from "../components/ui/skeleton";
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
      aria-label="Artwork viewer"
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
            aria-label="Loading artwork…"
            aria-busy="true"
            className="rounded-none"
            style={{ position: "absolute", inset: "4% 7%" }}
          />
        )}
        {lot.image && !imageFailed ? (
          <img
            alt={`${lot.title} by ${lot.artist}`}
            draggable="false"
            id="lot-img"
            src={lot.image}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <p className="hs-p-mini">Image unavailable</p>
        )}
        <div className="hs-floating-copy">
          <p className="hs-floating-collection">
            {collectionLabel ||
              `THE ${lot.provider === "cleveland" ? "CLEVELAND" : "CHICAGO"} COLLECTION`}{" "}
            / ARTWORK
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
        MOVE TO INSPECT <span aria-hidden="true">·</span> SCROLL TO ZOOM{" "}
        <span aria-hidden="true">·</span> DRAG OR USE ARROW KEYS WHEN ZOOMED
      </p>
      <div aria-label="Artwork zoom controls" className="hs-zoom-tools">
        <button
          aria-label="Zoom out"
          type="button"
          onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
        >
          −
        </button>
        <button aria-label="Reset view" type="button" onClick={resetView}>
          ↺
        </button>
        <output aria-live="off">{Math.round(zoom * 100)}%</output>
        <button
          aria-label="Zoom in"
          type="button"
          onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
        >
          +
        </button>
      </div>
    </div>
  );
}
