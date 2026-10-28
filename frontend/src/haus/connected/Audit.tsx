import { useEffect, useState } from "react";
import { BackButton } from "../shared";
import { dollars, useApiQuery } from "./queries";
type Entry = {
  lotId: string;
  sequence: number;
  previousHash: string | null;
  bidId: string;
  bidderAlias: string;
  amount: string;
  currency: string;
  acceptedAt: string;
  endTime: string;
  hash: string;
};
type AuditResult = {
  lotId: string;
  title: string;
  status: "intact" | "tampered" | "not_verifiable";
  reason: string;
  checkedAt: string;
  entries: Entry[];
  checkpoint: { sequence: number; hash: string } | null;
  history: {
    bidId: string;
    bidderLabel: string;
    amount: string;
    acceptedAt: string;
    covered: boolean;
  }[];
};
async function verifyInBrowser(result: AuditResult) {
  let previous: string | null = null;
  for (const [index, entry] of result.entries.entries()) {
    if (
      entry.lotId !== result.lotId ||
      entry.sequence !== index + 1 ||
      entry.previousHash !== previous
    )
      return false;
    const bytes = new TextEncoder().encode(
      JSON.stringify([
        "auction-bid-audit-v1",
        entry.lotId,
        entry.sequence,
        entry.previousHash,
        entry.bidId,
        entry.bidderAlias,
        entry.amount,
        entry.currency,
        entry.acceptedAt,
        entry.endTime,
      ]),
    );
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash = Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    if (hash !== entry.hash) return false;
    previous = hash;
  }
  return (
    result.entries.length > 0 &&
    result.checkpoint?.sequence === result.entries.length &&
    result.checkpoint.hash === previous
  );
}
export function Audit({ lotId }: { lotId: string | null }) {
  const [input, setInput] = useState(lotId ?? "");
  const query = useApiQuery<AuditResult>(
    lotId ? `/lots/${encodeURIComponent(lotId)}/audit` : null,
  );
  const [proof, setProof] = useState<{
    data: AuditResult;
    valid: boolean | null;
  } | null>(null);
  useEffect(() => {
    const data = query.data;
    if (!data || data.status !== "intact") return;
    let cancelled = false;
    void verifyInBrowser(data)
      .then((valid) => {
        if (!cancelled) setProof({ data, valid });
      })
      .catch(() => {
        if (!cancelled) setProof({ data, valid: null });
      });
    return () => {
      cancelled = true;
    };
  }, [query.data]);
  const data = query.data;
  const ready = proof?.data === data;
  const status =
    data?.status === "intact"
      ? !ready || proof?.valid === null
        ? "NOT VERIFIABLE"
        : proof?.valid
          ? "INTACT"
          : "TAMPERED"
      : data?.status === "tampered"
        ? "TAMPERED"
        : "NOT VERIFIABLE";
  return (
    <section
      className="hs-utility-page hs-seller-page"
      aria-label="Public audit"
    >
      <BackButton />
      <div className="hs-seller">
        <h1>PUBLIC AUDIT</h1>
        <p>
          Verify a lot’s bid history against checkpoints stored outside the
          database. No login required.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            location.hash = `/audit/${encodeURIComponent(input.trim())}`;
          }}
        >
          <label className="hs-seller-field">
            LOT ID
            <input
              className="hs-seller-input"
              required
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </label>
          <button className="hs-seller-btn" type="submit">
            VERIFY HISTORY
          </button>
        </form>
        {query.loading && <p role="status">Loading audit…</p>}
        {query.error && <p role="alert">{query.error}</p>}
        {data && (
          <>
            <h2>{data.title}</h2>
            <h3 role="status">{status}</h3>
            <p>
              {data.status === "intact" && status !== "INTACT"
                ? !ready
                  ? "Checking hashes in your browser…"
                  : proof?.valid === null
                    ? "Browser verification is unavailable. Use HTTPS or localhost."
                    : "The browser could not match the chain to the external checkpoint."
                : data.reason}
            </p>
            <p>
              Checked {new Date(data.checkedAt).toLocaleString()}. This is a
              point-in-time check; refresh for new bids.
            </p>
            <p>
              Trust boundary: the API and protected checkpoint storage.
              Database-only changes are detected; server or checkpoint-storage
              compromise is outside this guarantee.
            </p>
            {data.checkpoint && (
              <details>
                <summary>EXTERNAL CHECKPOINT</summary>
                <p>Sequence {data.checkpoint.sequence}</p>
                <code style={{ overflowWrap: "anywhere" }}>
                  {data.checkpoint.hash}
                </code>
              </details>
            )}
            <h3>COMPLETE BID HISTORY</h3>
            {!data.history.length && <p>No recorded bids.</p>}
            <ol>
              {data.history.map((bid) => (
                <li key={bid.bidId}>
                  <strong>{bid.bidderLabel}</strong> —{" "}
                  {dollars(
                    bid.amount,
                    data.entries.find((e) => e.bidId === bid.bidId)?.currency ??
                      "USD",
                  )}{" "}
                  — {new Date(bid.acceptedAt).toLocaleString()}
                  {!bid.covered && " — Outside audit coverage"}
                </li>
              ))}
            </ol>
            <button className="hs-seller-btn ghost" onClick={query.refresh}>
              REFRESH VERIFICATION
            </button>
          </>
        )}
      </div>
    </section>
  );
}
