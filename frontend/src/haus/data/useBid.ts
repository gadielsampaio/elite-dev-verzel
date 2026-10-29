import { useRef, useState, type FormEvent } from "react";
import { api, ApiError, message } from "../../api";
type Attempt = { amount: string; idempotencyKey: string };

export function useBid({
  lotId,
  userId,
  token,
  minimum,
  currency,
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
  const [pending, setPending] = useState<Attempt | null>(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      return typeof stored?.amount === "string" &&
        typeof stored?.idempotencyKey === "string"
        ? stored
        : null;
    } catch {
      return null;
    }
  });
  const [amount, setAmount] = useState(pending?.amount ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || (!eligible && !pending)) return;
    const attempt = pending ?? {
      amount: amount.trim(),
      idempotencyKey: crypto.randomUUID(),
    };
    if (
      !/^(?:0|[1-9]\d{0,16})(?:\.\d{1,2})?$/.test(attempt.amount) ||
      !/[1-9]/.test(attempt.amount)
    ) {
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
      sessionStorage.removeItem(storageKey);
      setPending(null);
      setAmount("");
      refresh(true);
    } catch (err) {
      if (
        err instanceof ApiError &&
        [400, 403, 404, 409].includes(err.status)
      ) {
        sessionStorage.removeItem(storageKey);
        setPending(null);
        refresh();
      }
      if (
        err instanceof ApiError &&
        err.status === 409 &&
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
