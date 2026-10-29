import { useRef, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { hasApiStatus } from "../api/errors";
import { message } from "../utils/errors";
import type { PendingAmount } from "../types/pendingAmount";
import { readPendingAmount } from "../utils/pendingAmount";

const REJECTED_BID_STATUSES = [400, 403, 404, 409];

function isValidBidAmount(amount: string) {
  return /^(?:0|[1-9]\d{0,16})(?:\.\d{1,2})?$/.test(amount) && /[1-9]/.test(amount);
}

export function useBid({
  lotId,
  userId,
  token,
  eligible,
  refresh,
  onInsufficientBalance,
}: {
  lotId: string;
  userId: string;
  token: string;
  minimum: string | null;
  currency: string;
  eligible: boolean;
  refresh: (accepted?: boolean) => void;
  onInsufficientBalance?: () => void;
}) {
  const storageKey = `pending-bid:${userId}:${lotId}`;
  const [pending, setPending] = useState<PendingAmount | null>(
    () => readPendingAmount(storageKey),
  );
  const [amount, setAmount] = useState(pending?.amount ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  function clearPending() {
    sessionStorage.removeItem(storageKey);
    setPending(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || (!eligible && !pending)) return;

    const attempt = pending ?? {
      amount: amount.trim(),
      idempotencyKey: crypto.randomUUID(),
    };
    if (!isValidBidAmount(attempt.amount)) {
      setError("Enter a positive amount with at most two decimal places.");
      return;
    }

    inFlight.current = true;
    setBusy(true);
    setError("");

    try {
      // Persist before sending so reopening the room cannot duplicate an uncertain bid.
      sessionStorage.setItem(storageKey, JSON.stringify(attempt));
      setPending(attempt);
      await api(`/lots/${lotId}/bids`, token, {
        method: "POST",
        body: JSON.stringify(attempt),
      });
      clearPending();
      setAmount("");
      refresh(true);
    } catch (err) {
      if (hasApiStatus(err, REJECTED_BID_STATUSES)) {
        clearPending();
        refresh();
      }
      if (
        hasApiStatus(err, [409]) &&
        err.message === "Insufficient available balance" &&
        onInsufficientBalance
      ) {
        onInsufficientBalance();
        return;
      }

      setError(message(err));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return { amount, setAmount, pending, busy, error, submit };
}
