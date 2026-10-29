import { useEffect, useState } from "react";
import { useApiQuery } from "./queries";
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
export type AuditResult = {
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
export function useAudit(lotId: string | null) {
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
  return { query, data, ready, proof, status };
}
