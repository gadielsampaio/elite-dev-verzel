import { useRef, useState } from "react";
import { cancelLot } from "../api/lots";
import { message } from "../utils/errors";
import type { OwnedLot } from "../types/seller";
import { useSession } from "./useSession";
import { useApiQuery } from "./useApiQuery";
import type { PageResult } from "../types/pagination";

const SELLER_PAGE_SIZE = 9;

export function useSellerLots(
  onChanged?: () => void,
  resultsOnly = false,
  confirmBeforeCancel = true,
) {
  const { session } = useSession();
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const cancellationInFlight = useRef(false);
  const query = useApiQuery<PageResult<OwnedLot>>(
    session?.user.role === "auctioneer"
      ? `/lots/mine?page=${page}&limit=${SELLER_PAGE_SIZE}${resultsOnly ? "&status=closed" : ""}`
      : null,
    session?.token,
  );

  async function cancel(lot: OwnedLot) {
    if (!session || cancellationInFlight.current) return;
    if (confirmBeforeCancel && !confirm(`Cancel “${lot.title}”?`)) return;

    cancellationInFlight.current = true;
    setBusy(lot.id);
    setError("");
    setNotice("");

    try {
      await cancelLot(lot.id, session.token);
      setNotice("Lot cancelled. Any reserved funds have been released as a refund.");
    } catch (e) {
      setError(message(e));
    } finally {
      cancellationInFlight.current = false;
      setBusy(null);
      query.refresh();
      onChanged?.();
    }
  }

  return { page, setPage, busy, error, notice, query, cancel };
}
