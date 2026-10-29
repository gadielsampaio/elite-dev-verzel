import { useState, type ReactNode } from "react";
import { ArtworkScene } from "../../ArtworkScene";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../../../components/ui/dialog";
import "./immersive-room.css";

// Render the original scene and its CSS, including its caption and zoom controls.
export function ArtworkViewer({
  image,
  preview,
  title,
  artist,
  year,
  provider,
  children,
}: {
  image: string;
  preview?: string | null;
  title: string;
  artist: string;
  year: string;
  provider?: string;
  children: ReactNode;
}) {
  const [caption, setCaption] = useState(true);
  const close = () => {
    location.hash = "/home";
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className={`translate-x-0 translate-y-0 hs-preview-dialog open hs-shadcn-room${caption ? " caption-visible" : ""}`}
      >
        <DialogTitle asChild>
          <h1 className="sr-only">{title}</h1>
        </DialogTitle>
        <div
          aria-hidden="true"
          className="hs-immersive-background"
          style={
            preview || image
              ? { backgroundImage: `url("${preview || image}")` }
              : undefined
          }
        />
        <div aria-hidden="true" className="hs-immersive-vignette" />
        <div aria-hidden="true" className="hs-immersive-topline">
          <span>HAUS SAMPAIO</span>
          <span>THE COLLECTION</span>
        </div>
        <button
          type="button"
          className="hs-preview-close"
          aria-label="Close artwork room"
          onClick={close}
        >
          <span>CLOSE ROOM</span>
          <span aria-hidden="true" className="hs-close-icon">
            ×
          </span>
        </button>
        <div
          style={{ display: "contents" }}
          onClick={(event) => {
            if (
              !(event.target as HTMLElement).closest(
                "button,input,.hs-zoom-tools",
              )
            )
              setCaption((value) => !value);
          }}
        >
          <ArtworkScene
            collectionLabel="THE COLLECTION"
            lot={{ image, title, artist, year, provider }}
          />
        </div>
        <aside
          className="hs-room-card"
          aria-label="Lot and bidding information"
        >
          {children}
        </aside>
      </DialogContent>
    </Dialog>
  );
}
