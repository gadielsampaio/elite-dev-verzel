import { useRef, useState } from "react";
import { api, message, type Lot } from "../../api";
import { useSession } from "../../session";
import { Artwork } from "./Storefront";
import { dollars, useApiQuery, type PageResult } from "./queries";
type OwnedLot = Omit<Lot, "status"> & {
  status: Lot["status"] | "cancelled" | "draft";
  bidCount: number;
  canCancel: boolean;
};
export function SellerLots({
  open,
  create,
  resultsOnly = false,
  onChanged,
}: {
  open: (id: string) => void;
  create: () => void;
  resultsOnly?: boolean;
  onChanged?: () => void;
}) {
  const { session } = useSession();
  const [page, setPage] = useState(1),
    [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const pending = useRef(false);
  const query = useApiQuery<PageResult<OwnedLot>>(
    session?.user.role === "auctioneer"
      ? `/lots/mine?page=${page}&limit=9${resultsOnly ? "&status=closed" : ""}`
      : null,
    session?.token,
  );
  async function cancel(lot: OwnedLot) {
    if (!session || pending.current || !confirm(`Cancel “${lot.title}”?`))
      return;
    pending.current = true;
    setBusy(lot.id);
    setError("");
    setNotice("");
    try {
      await api(`/lots/${lot.id}/cancel`, session.token, {
        method: "PATCH",
        body: "{}",
      });
      setNotice("Lot cancelled. It is no longer in the public collection.");
    } catch (e) {
      setError(message(e));
    } finally {
      pending.current = false;
      setBusy(null);
      query.refresh();
      onChanged?.();
    }
  }
  return (
    <>
      <div className="hs-seller-subheading">
        <h2 className="hs-seller-section-title">
          {resultsOnly ? "CLOSED AUCTIONS" : "YOUR COLLECTION"}
        </h2>
        <span className="hs-seller-muted">{query.data?.total ?? "—"} LOTS</span>
      </div>
      {notice && (
        <p className="hs-seller-flash" role="status">
          {notice}
        </p>
      )}
      {(error || query.error) && (
        <p className="hs-seller-error" role="alert">
          {error || query.error}
        </p>
      )}
      {query.loading ? (
        <p role="status">Loading your lots…</p>
      ) : query.data?.items.length ? (
        query.data.items.map((lot) => (
          <div key={lot.id} className="hs-seller-row">
            <Artwork lot={lot} />
            <div>
              <div className="hs-seller-row-title">{lot.title}</div>
              <div className="hs-seller-row-sub">
                {lot.items[0]?.artistDisplay}
              </div>
              <div className="hs-seller-row-sub">
                <span className="hs-seller-tag">{lot.status}</span> ·{" "}
                {lot.bidCount} bid(s)
              </div>
            </div>
            <div className="hs-seller-date hs-seller-muted">
              {new Date(lot.startTime).toLocaleString()}
              <br />
              TO {new Date(lot.endTime).toLocaleString()}
            </div>
            <div className="hs-seller-price">
              <span className="hs-seller-muted">STARTING BID</span>
              <br />
              {dollars(lot.startingBid, lot.currency)}
            </div>
            <div className="hs-seller-action">
              {lot.status === "closed" && (
                <a
                  className="hs-seller-text-link"
                  href={`/#/receipt/${lot.id}`}
                >
                  VIEW RESULT / RECEIPT ↗
                </a>
              )}
              {!["draft", "cancelled"].includes(lot.status) && (
                <button
                  className="hs-seller-text-link"
                  onClick={() => open(lot.id)}
                >
                  VIEW LOT ↗
                </button>
              )}
              {lot.canCancel && (
                <button
                  className="hs-seller-btn ghost"
                  disabled={!!busy}
                  onClick={() => void cancel(lot)}
                >
                  {busy === lot.id ? "CANCELLING…" : "CANCEL LOT"}
                </button>
              )}
            </div>
          </div>
        ))
      ) : (
        query.data && (
          <div className="hs-seller-empty">
            {resultsOnly ? "No closed auctions yet." : "No lots yet."}{" "}
            <button className="hs-seller-text-link" onClick={create}>
              CREATE YOUR FIRST LOT ↗
            </button>
          </div>
        )
      )}
      <div className="hs-seller-pagination">
        <button
          className="hs-seller-btn ghost"
          disabled={query.loading || page === 1 || !!busy}
          onClick={() => setPage((p) => p - 1)}
        >
          PREVIOUS LOTS
        </button>
        <span>PAGE {page}</span>
        <button
          className="hs-seller-btn ghost"
          disabled={
            query.loading ||
            !query.data ||
            page * 9 >= query.data.total ||
            !!busy
          }
          onClick={() => setPage((p) => p + 1)}
        >
          NEXT LOTS
        </button>
      </div>
      <button
        className="hs-seller-text-link"
        disabled={!!busy}
        onClick={() => {
          query.refresh();
          onChanged?.();
        }}
      >
        REFRESH MY LOTS
      </button>
      <p className="hs-seller-notice">
        Cancellation is available only before any bid and before the deadline.
        Closed lots link to their public result; the Results tab confirms
        settlement.
      </p>
    </>
  );
}
