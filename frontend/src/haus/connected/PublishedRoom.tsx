import type { Result } from "./Receipt";
import { useLotRealtime } from "./useLotRealtime";
import { useEffect, useRef, useState } from "react";
import { BidForm } from "./BidForm";
import type { Lot } from "../../api";
import { useSession } from "../../session";
import { ArtworkScene } from "../LotRoom";
import { Modal } from "../shared";
import { clock, useHaus } from "../model";
import { dollars, useApiQuery, type BidSummary } from "./queries";
type Position = {
  bidderAlias?: string;
  position: number | null;
  isLeading: boolean;
  bestBid: unknown;
};
export function PublishedRoom({
  id,
  close,
}: {
  id: string;
  close: () => void;
}) {
  const { now } = useHaus(),
    { session } = useSession();
  const [page, setPage] = useState(1),
    [tab, setTab] = useState("bids"),
    [caption, setCaption] = useState(true),
    [bidNotice, setBidNotice] = useState("");
  const detail = useApiQuery<Lot>(`/lots/${id}`, undefined, true);
  const history = useApiQuery<BidSummary>(
    detail.data ? `/lots/${id}/bids?page=${page}&limit=20` : null,
    undefined,
    true,
  );
  const position = useApiQuery<Position>(
    detail.data && session ? `/lots/${id}/bids/me` : null,
    session?.token,
    true,
  );
  const result = useApiQuery<Result>(
    history.data?.status === "closed" ? `/lots/${id}/result` : null,
    undefined,
    true,
  );
  const received = useRef({ data: history.data, at: now });
  if (received.current.data !== history.data)
    received.current = { data: history.data, at: now };
  const serverNow = history.data
    ? Date.parse(history.data.serverTime) + now - received.current.at
    : now;
  const lot = detail.data,
    bids = history.data,
    item = lot?.items[0];
  const refresh = () => {
    detail.refresh();
    history.refresh();
    position.refresh();
    result.refresh();
  };
  const liveUpdates = useLotRealtime(id, refresh);
  useEffect(() => {
    if (!bids || !lot || !["scheduled", "open"].includes(bids.status)) return;
    const boundary = bids.status === "scheduled" ? lot.startTime : bids.endTime;
    const timeout = setTimeout(
      refresh,
      Math.min(
        2147483647,
        Math.max(100, Date.parse(boundary) - serverNow + 100),
      ),
    );
    return () => clearTimeout(timeout);
    // Recalculate from a fresh server response, not every countdown tick.
  }, [bids, lot?.startTime]);
  return (
    <Modal
      id="lot-dialog"
      className={`hs-preview-dialog open${caption ? " caption-visible" : ""}`}
      labelledBy="lot-title"
      onClose={close}
    >
      <div
        aria-hidden="true"
        className="hs-immersive-background"
        style={
          item?.imageUrl
            ? { backgroundImage: `url("${item.imageUrl}")` }
            : undefined
        }
      />
      <div aria-hidden="true" className="hs-immersive-vignette" />
      <div aria-hidden="true" className="hs-immersive-topline">
        <span>HAUS SAMPAIO</span>
        <span>THE COLLECTION</span>
      </div>
      <button
        className="hs-preview-close"
        aria-label="Close artwork room"
        onClick={close}
      >
        <span>CLOSE ROOM</span>
        <span aria-hidden="true" className="hs-close-icon">
          ×
        </span>
      </button>
      {lot ? (
        <div
          style={{ display: "contents" }}
          onClick={(e) => {
            if (
              !(e.target as HTMLElement).closest("button,input,.hs-zoom-tools")
            )
              setCaption((v) => !v);
          }}
        >
          <ArtworkScene
            collectionLabel="THE COLLECTION"
            lot={{
              title: lot.title,
              artist: item?.artistDisplay || "Artist not listed",
              year: item?.sourceSnapshot?.dateDisplay || "—",
              image: item?.imageUrl || "",
              provider: item?.sourceSnapshot?.provider,
            }}
          />
        </div>
      ) : (
        <h2 id="lot-title" className="hs-p-title">
          {detail.error ? "LOT UNAVAILABLE" : "LOADING LOT…"}
        </h2>
      )}
      <aside
        className="hs-preview-details"
        aria-label="Lot and bidding information"
      >
        <div className="hs-p-topline">
          <span data-live={bids?.status === "open"}>
            {bids?.status === "open"
              ? "● LIVE NOW"
              : (bids?.status || lot?.status || "").toUpperCase()}
          </span>
        </div>
        <h3 className="hs-room-label">THE AUCTION ROOM</h3>
        {lot && (
          <>
            <div className="hs-p-grid">
              <div>
                <p className="hs-p-label">
                  {bids?.status === "closed" ? "LAST BID" : "CURRENT BID"}
                </p>
                <p className="hs-p-value">
                  {bids
                    ? dollars(
                        bids.currentBid ?? bids.startingBid,
                        bids.currency,
                      )
                    : "—"}
                </p>
              </div>
              <div>
                <p className="hs-p-label">TIME REMAINING</p>
                <p className="hs-p-value">
                  {bids
                    ? bids.status === "open"
                      ? clock(Date.parse(bids.endTime), serverNow)
                      : bids.status === "scheduled"
                        ? "UPCOMING"
                        : "CLOSED"
                    : "—"}
                </p>
              </div>
            </div>
            {position.data && (
              <p
                className={`hs-p-standing${position.data.isLeading ? " leading" : position.data.bestBid ? " outbid" : ""}`}
              >
                {position.data.isLeading
                  ? "● YOU ARE CURRENTLY LEADING"
                  : position.data.bestBid
                    ? "● YOU HAVE BEEN OUTBID"
                    : "NO BIDS PLACED"}
                {position.data.position !== null &&
                  ` · POSITION ${position.data.position}`}
              </p>
            )}
            <p className="hs-p-mini" aria-live="polite">
              {liveUpdates
                ? "LIVE UPDATES CONNECTED"
                : "CONNECTING LIVE UPDATES · AUTOMATIC REFRESH ACTIVE"}
            </p>
            <div className="hs-p-tabs">
              <button
                className={tab === "bids" ? "active" : ""}
                onClick={() => setTab("bids")}
              >
                BIDS &amp; HISTORY
              </button>
              <button
                className={tab === "details" ? "active" : ""}
                onClick={() => setTab("details")}
              >
                ARTWORK DETAILS
              </button>
            </div>
            {tab === "details" ? (
              <div className="hs-p-mini" style={{ marginTop: 24 }}>
                <p>
                  {item?.sourceSnapshot?.mediumDisplay || "Medium not listed"}
                </p>
                <p>STARTS: {new Date(lot.startTime).toLocaleString()}</p>
                <p>
                  ENDS:{" "}
                  {new Date(bids?.endTime ?? lot.endTime).toLocaleString()}
                </p>
                <p>
                  MINIMUM INCREMENT: {dollars(lot.bidIncrement, lot.currency)}
                </p>
                {item?.sourceSnapshot?.provider === "mock" && (
                  <p>Artwork from the development catalog.</p>
                )}
              </div>
            ) : (
              <>
                {session?.user.role === "bidder" ? (
                  <BidForm
                    key={`${id}:${session.user.id}`}
                    lotId={id}
                    userId={session.user.id}
                    token={session.token}
                    minimum={bids?.minimumNextBid ?? null}
                    currency={lot.currency}
                    eligible={
                      bids?.status === "open" &&
                      serverNow < Date.parse(bids.endTime) &&
                      !!position.data &&
                      !position.data.isLeading
                    }
                    refresh={(accepted) => {
                      if (accepted)
                        setBidNotice(
                          "Bid accepted. Refreshing history and your position.",
                        );
                      history.refresh();
                      position.refresh();
                    }}
                  />
                ) : (
                  <p className="hs-p-mini" style={{ marginTop: 22 }}>
                    {session
                      ? "Only bidder accounts can place bids."
                      : "Sign in as a bidder to place a bid."}
                  </p>
                )}
                {bids?.status === "closed" && (
                  <p className="hs-p-mini">
                    {result.data?.status === "settled"
                      ? "SETTLED — RECEIPT AVAILABLE. "
                      : result.data?.status === "no_winner"
                        ? "CLOSED WITHOUT A WINNER. "
                        : "BIDDING CLOSED — SETTLEMENT PENDING. "}
                    <a href={`#/receipt/${id}`} onClick={close}>
                      View settlement result and receipt
                    </a>
                    .
                  </p>
                )}
                <div className="hs-p-line">
                  <p>
                    <a href={`#/audit/${id}`} onClick={close}>
                      VERIFY BID HISTORY
                    </a>
                  </p>
                  <p className="hs-p-label">BID HISTORY</p>
                  <div className="hs-p-history">
                    {history.loading ? (
                      <p role="status">Loading history…</p>
                    ) : bids?.items.length ? (
                      bids.items.map((b) => (
                        <div className="hs-p-bid-row" key={b.id}>
                          <span style={{ overflowWrap: "anywhere" }}>
                            {b.bidderAlias === position.data?.bidderAlias
                              ? "You"
                              : b.bidderLabel || "Bidder"}
                          </span>
                          <strong>{dollars(b.amount, bids.currency)}</strong>
                        </div>
                      ))
                    ) : (
                      !history.error && <p>NO BIDS YET</p>
                    )}
                  </div>
                  {bids && bids.total > 20 && (
                    <div className="hs-p-tabs">
                      <button
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        ← PREVIOUS
                      </button>
                      <button
                        disabled={page * 20 >= bids.total}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        NEXT →
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
        {bidNotice && (
          <p className="hs-p-feedback" role="status">
            {bidNotice}
          </p>
        )}
        {[detail.error, history.error, position.error]
          .filter(Boolean)
          .map((error, i) => (
            <p key={i} className="hs-p-feedback" role="alert">
              {error}
            </p>
          ))}
        <button className="hs-primary-link" onClick={refresh}>
          REFRESH LOT <span>↻</span>
        </button>
      </aside>
    </Modal>
  );
}
