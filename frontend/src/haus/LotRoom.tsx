import { useEffect, useRef, useState } from "react";
import { clock, current, money, status, useHaus } from "./model";
import { Modal, MoneyInput } from "./shared";
import type { Lot } from "./types";
export function ArtworkScene({
  lot,
  collectionLabel,
}: {
  lot: Pick<Lot, "title" | "image" | "artist" | "year" | "provider">;
  collectionLabel?: string;
}) {
  const scene = useRef<HTMLDivElement>(null),
    figure = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [lot.image]);
  const target = useRef({ x: 0, y: 0, z: 1 });
  const schedule = useRef(() => {});
  useEffect(() => {
    target.current.z = zoom;
    schedule.current();
  }, [zoom]);
  useEffect(() => {
    const element = scene.current!,
      image = figure.current!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      x = 0,
      y = 0,
      z = 1;
    function draw() {
      frame = 0;
      const ease = reduced.matches ? 1 : 0.13;
      x += (target.current.x - x) * ease;
      y += (target.current.y - y) * ease;
      z += (target.current.z - z) * (reduced.matches ? 1 : 0.17);
      image.style.transform = `rotateX(${x.toFixed(3)}deg) rotateY(${y.toFixed(3)}deg) scale(${z.toFixed(4)})`;
      if (
        Math.abs(target.current.x - x) > 0.006 ||
        Math.abs(target.current.y - y) > 0.006 ||
        Math.abs(target.current.z - z) > 0.0006
      )
        schedule.current();
    }
    schedule.current = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    function move(e: PointerEvent) {
      if (reduced.matches || !["mouse", "pen"].includes(e.pointerType)) return;
      const rect = element.getBoundingClientRect();
      target.current.x =
        -Math.max(
          -0.5,
          Math.min(0.5, (e.clientY - rect.top) / rect.height - 0.5),
        ) * 17;
      target.current.y =
        Math.max(
          -0.5,
          Math.min(0.5, (e.clientX - rect.left) / rect.width - 0.5),
        ) * 19;
      schedule.current();
    }
    function leave() {
      target.current.x = 0;
      target.current.y = 0;
      schedule.current();
    }
    function wheel(e: WheelEvent) {
      if ((e.target as HTMLElement).closest(".hs-zoom-tools")) return;
      e.preventDefault();
      setZoom((z) => Math.min(3, Math.max(1, z - e.deltaY * 0.0025)));
    }
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerleave", leave);
    element.addEventListener("wheel", wheel, { passive: false });
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      schedule.current = () => {};
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerleave", leave);
      element.removeEventListener("wheel", wheel);
    };
  }, []);
  return (
    <div className="hs-immersive-scene" id="lot-scene" ref={scene}>
      <div className="hs-art-figure" id="lot-figure" ref={figure}>
        {lot.image && !imageFailed ? (
          <img
            alt={`${lot.title} by ${lot.artist}`}
            draggable="false"
            id="lot-img"
            src={lot.image}
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
      <p className="hs-immersive-instructions">
        MOVE TO INSPECT <span aria-hidden="true">·</span> SCROLL TO ZOOM{" "}
        <span aria-hidden="true">·</span> CLICK TO TOGGLE ARTWORK INFO
      </p>
      <div aria-label="Artwork zoom controls" className="hs-zoom-tools">
        <button
          aria-label="Zoom out"
          type="button"
          onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
        >
          −
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
export function LotRoom({ lot }: { lot: Lot }) {
  const { lots, role, now, setActiveId, bid } = useHaus();
  const [caption, setCaption] = useState(true),
    [tab, setTab] = useState("bids");
  const [amount, setAmount] = useState(
      lot.bids.length ? current(lot) + lot.increment : lot.start,
    ),
    [feedback, setFeedback] = useState("");
  const state = status(lot, now),
    leading = lot.bids.at(-1)?.person === role,
    outbid = lot.bids.some((b) => b.person === role);
  const standing =
    state !== "live" || !lot.bids.length
      ? ""
      : !role.startsWith("Collector")
        ? "SIGN IN AS A COLLECTOR TO PLACE A DEMO BID"
        : leading
          ? "● YOU ARE CURRENTLY LEADING"
          : outbid
            ? "● YOU HAVE BEEN OUTBID"
            : "BIDDING IS OPEN";
  return (
    <Modal
      id="lot-dialog"
      className={`hs-preview-dialog open${caption ? " caption-visible" : ""}`}
      labelledBy="lot-title"
      onClose={() => setActiveId(null)}
    >
      <div
        aria-hidden="true"
        className="hs-immersive-background"
        style={{ backgroundImage: `url("${lot.image}")` }}
      />
      <div aria-hidden="true" className="hs-immersive-vignette" />
      <div aria-hidden="true" className="hs-immersive-topline">
        <span>HAUS SAMPAIO</span>
        <span>
          THE {lot.provider === "cleveland" ? "CLEVELAND" : "CHICAGO"}{" "}
          COLLECTION / 2026
        </span>
      </div>
      <button
        aria-label="Close artwork room"
        className="hs-preview-close"
        onClick={() => setActiveId(null)}
      >
        <span>CLOSE ROOM</span>
        <span aria-hidden="true" className="hs-close-icon">
          ×
        </span>
      </button>
      <div
        style={{ display: "contents" }}
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest("button,input,.hs-zoom-tools"))
            setCaption((c) => !c);
        }}
      >
        <ArtworkScene lot={lot} />
      </div>
      <aside
        aria-label="Lot and bidding information"
        className="hs-preview-details"
      >
        <div className="hs-p-topline">
          <span data-live={state === "live"}>
            {state === "live" ? "● LIVE NOW" : state.toUpperCase()}
          </span>
          <span>LOT {String(lots.indexOf(lot) + 1).padStart(3, "0")}</span>
        </div>
        <h3 className="hs-room-label">THE AUCTION ROOM</h3>
        <div className="hs-p-grid">
          <div>
            <p className="hs-p-label">
              {state === "scheduled"
                ? "STARTING BID"
                : state === "closed"
                  ? "WINNING BID"
                  : "CURRENT BID"}
            </p>
            <p className="hs-p-value">{money(current(lot))}</p>
          </div>
          <div>
            <p className="hs-p-label">TIME REMAINING</p>
            <p className="hs-p-value">
              {state === "live"
                ? clock(lot.endsAt, now)
                : state === "scheduled"
                  ? "UPCOMING"
                  : "CLOSED"}
            </p>
          </div>
        </div>
        <p
          aria-live="polite"
          className={`hs-p-standing${leading ? " leading" : outbid ? " outbid" : ""}`}
        >
          {standing}
        </p>
        <div className="hs-p-tabs">
          <button
            className={tab === "bids" ? "active" : ""}
            onClick={() => setTab("bids")}
            type="button"
          >
            BIDS &amp; HISTORY
          </button>
          <button
            className={tab === "details" ? "active" : ""}
            onClick={() => setTab("details")}
            type="button"
          >
            ARTWORK DETAILS
          </button>
        </div>
        <div>
          {tab === "details" ? (
            <p className="hs-p-mini" style={{ marginTop: 24 }}>
              {lot.description}
              <br />
              VISUAL REFERENCE /{" "}
              {lot.provider === "cleveland"
                ? "CLEVELAND MUSEUM OF ART"
                : "ART INSTITUTE OF CHICAGO"}
              . NOT ACTUALLY FOR SALE.
            </p>
          ) : (
            <>
              {state === "live" ? (
                <>
                  <p className="hs-p-mini" style={{ marginTop: 22 }}>
                    ACTIVE DEMO PROFILE: {role} · MINIMUM BID:{" "}
                    {money(
                      lot.bids.length
                        ? current(lot) + lot.increment
                        : lot.start,
                    )}
                  </p>
                  <MoneyInput
                    className="hs-p-input hs-money-input"
                    aria-label="Bid amount"
                    value={amount}
                    onValue={setAmount}
                  />
                  <button
                    className="hs-primary-link"
                    onClick={() => {
                      const result = bid(lot.id, amount);
                      setFeedback(result);
                      if (result.startsWith("Demo bid accepted"))
                        setAmount(amount + lot.increment);
                    }}
                  >
                    PLACE DEMO BID <span>↗</span>
                  </button>
                  <div
                    className={`hs-p-feedback${feedback.startsWith("Demo bid accepted") ? " accepted" : ""}`}
                    role="status"
                  >
                    {feedback}
                  </div>
                </>
              ) : (
                <p className="hs-p-mini" style={{ marginTop: 22 }}>
                  {state === "scheduled"
                    ? "Bidding has not started."
                    : "Bidding has closed."}
                </p>
              )}
              <div className="hs-p-line">
                <p className="hs-p-label">BID HISTORY</p>
                <div className="hs-p-history">
                  {lot.bids.length ? (
                    [...lot.bids].reverse().map((b, i) => (
                      <div className="hs-p-bid-row" key={i}>
                        <span>{b.person}</span>
                        <strong>{money(b.value)}</strong>
                      </div>
                    ))
                  ) : (
                    <p>NO BIDS YET</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </Modal>
  );
}
