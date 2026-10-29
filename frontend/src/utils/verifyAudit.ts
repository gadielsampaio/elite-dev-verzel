import type { AuditResult } from "../types/audit";

export async function verifyAuditInBrowser(result: AuditResult) {
  let previousHash: string | null = null;
  for (const [index, entry] of result.entries.entries()) {
    if (
      entry.lotId !== result.lotId ||
      entry.sequence !== index + 1 ||
      entry.previousHash !== previousHash
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
    const hash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");

    if (hash !== entry.hash) return false;
    previousHash = hash;
  }

  return (
    result.entries.length > 0 &&
    result.checkpoint?.sequence === result.entries.length &&
    result.checkpoint.hash === previousHash
  );
}
