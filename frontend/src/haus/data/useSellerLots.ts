import { useRef, useState } from "react";
import { api, message, type Lot } from "../../api";
import { useSession } from "../../session";
import { useApiQuery, type PageResult } from "./queries";
export type OwnedLot = Omit<Lot, "status"> & {
  status: Lot["status"] | "cancelled" | "draft";
  bidCount: number;
  canCancel: boolean;
};
export function useSellerLots(
  onChanged?: () => void,
  resultsOnly = false,
  confirmBeforeCancel = true,
) {
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
    if (
      !session ||
      pending.current ||
      (confirmBeforeCancel && !confirm(`Cancel “${lot.title}”?`))
    )
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
  return { page, setPage, busy, error, notice, query, cancel };
}
