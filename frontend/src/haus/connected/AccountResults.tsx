import { useState } from "react";
import { useSession } from "../../session";
import { BackButton } from "../shared";
import { dollars, useApiQuery, type PageResult } from "./queries";

export type AccountResult = {
  lotId: string;
  title: string;
  currency: string;
  status: string;
  outcome: string;
  endTime: string;
  settledAt: string | null;
  amount: string | null;
  receiptPath: string | null;
  won?: boolean;
  myBestBid?: string | null;
  items: { name: string; imageUrl: string | null }[];
};

export function AccountResults({
  seller = false,
  open,
  onRefresh,
}: {
  seller?: boolean;
  open: (id: string) => void;
  onRefresh?: () => void;
}) {
  const { session } = useSession();
  const allowed = session?.user.role === (seller ? "auctioneer" : "bidder");
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const query = useApiQuery<PageResult<AccountResult>>(
    allowed
      ? `/me/${seller ? "auction-results" : "participations"}?page=${page}&limit=9${seller ? "" : `&filter=${filter}`}`
      : null,
    session?.token,
  );
  return (
    <section aria-label={seller ? "Seller results" : "My bids and wins"}>
      {!seller && (
        <>
          <BackButton />
          <div className="hs-page-heading">
            <h1 className="hs-page-title">MY BIDS &amp; WINS</h1>
            <p className="hs-page-lead">
              Your auction participation and confirmed winning receipts.
            </p>
          </div>
        </>
      )}
      {!allowed ? (
        <p role="alert">{seller ? "Auctioneer" : "Bidder"} account required.</p>
      ) : (
        <>
          {!seller && (
            <div
              className="hs-seller-tabs"
              role="tablist"
              aria-label="Participation filter"
            >
              {[
                ["all", "ALL PARTICIPATION"],
                ["wins", "MY WINS"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={filter === id}
                  onClick={() => {
                    setPage(1);
                    setFilter(id);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <h2 className="hs-seller-section-title">
            {seller
              ? "AUCTION RESULTS"
              : filter === "wins"
                ? "CONFIRMED WINS"
                : "YOUR AUCTIONS"}
          </h2>
          {query.loading && <p role="status">Loading results…</p>}
          {query.error && (
            <p className="hs-seller-error" role="alert">
              {query.error}
            </p>
          )}
          {query.data?.items.length === 0 && (
            <p className="hs-seller-empty">
              No{" "}
              {seller
                ? "closed auctions"
                : filter === "wins"
                  ? "confirmed wins"
                  : "participation"}{" "}
              yet.
            </p>
          )}
          {query.data?.items.map((result) => (
            <article
              key={result.lotId}
              className="hs-seller-row hs-account-result-row"
            >
              {result.items[0]?.imageUrl ? (
                <img
                  src={result.items[0].imageUrl}
                  alt={result.items[0].name}
                  onError={(event) => {
                    event.currentTarget.style.visibility = "hidden";
                  }}
                />
              ) : (
                <span>Image unavailable</span>
              )}
              <div>
                <h3 className="hs-seller-row-title">{result.title}</h3>
                <p className="hs-seller-row-sub">
                  {result.outcome === "settled"
                    ? seller
                      ? "SOLD · SETTLED"
                      : result.won
                        ? "WON · SETTLED"
                        : "NOT WON · SETTLED"
                    : result.outcome === "pending_settlement"
                      ? "SETTLEMENT PENDING"
                      : result.outcome === "no_winner"
                        ? "CLOSED WITHOUT A WINNER"
                        : result.status.toUpperCase()}
                </p>
                {result.myBestBid && (
                  <p className="hs-seller-row-sub">
                    YOUR HIGHEST BID:{" "}
                    {dollars(result.myBestBid, result.currency)}
                  </p>
                )}
              </div>
              <div className="hs-seller-date hs-seller-muted">
                ENDS
                <br />
                {new Date(result.endTime).toLocaleString()}
              </div>
              <div className="hs-seller-price">
                {result.amount !== null ? (
                  <>
                    <span className="hs-seller-muted">SETTLED AMOUNT</span>
                    <br />
                    {dollars(result.amount, result.currency)}
                  </>
                ) : (
                  "—"
                )}
              </div>
              <div className="hs-seller-action">
                {result.receiptPath && (
                  <a className="hs-seller-text-link" href={result.receiptPath}>
                    VIEW / SHARE RECEIPT ↗
                  </a>
                )}
                {result.status !== "cancelled" && (
                  <button
                    className="hs-seller-text-link"
                    onClick={() => open(result.lotId)}
                  >
                    VIEW LOT ↗
                  </button>
                )}
              </div>
            </article>
          ))}
          <div className="hs-seller-pagination">
            <button
              className="hs-seller-btn ghost"
              disabled={page === 1 || query.loading}
              onClick={() => setPage((p) => p - 1)}
            >
              PREVIOUS RESULTS
            </button>
            <span>
              PAGE {page} · {query.data?.total ?? "—"} LOTS
            </span>
            <button
              className="hs-seller-btn ghost"
              disabled={
                query.loading || !query.data || page * 9 >= query.data.total
              }
              onClick={() => setPage((p) => p + 1)}
            >
              NEXT RESULTS
            </button>
          </div>
          <button
            className="hs-seller-text-link"
            onClick={() => {
              query.refresh();
              onRefresh?.();
            }}
          >
            REFRESH RESULTS
          </button>
          <p className="hs-seller-notice">
            Only completed settlements count as sales or wins. Receipts use
            simulated funds.
          </p>
        </>
      )}
    </section>
  );
}
