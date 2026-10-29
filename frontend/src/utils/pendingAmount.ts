import type { PendingAmount } from "../types/pendingAmount";

export function readPendingAmount(storageKey: string): PendingAmount | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    if (typeof stored?.amount !== "string") return null;
    if (typeof stored?.idempotencyKey !== "string") return null;

    return stored;
  } catch {
    return null;
  }
}
