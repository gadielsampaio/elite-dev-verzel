import { useLiveRefresh } from "./haus/connected/useLiveRefresh";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError, message, type Wallet } from "./api";
type Pending = { amount: string; idempotencyKey: string };
export function useWallet({
  token,
  userId,
}: {
  token: string;
  userId: string;
}) {
  const storageKey = `pending-deposit:${userId}`;
  const [pending, setPending] = useState<Pending | null>(() => {
    try {
      const item = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      return typeof item?.amount === "string" &&
        typeof item?.idempotencyKey === "string"
        ? item
        : null;
    } catch {
      return null;
    }
  });
  const [wallet, setWallet] = useState<Wallet | null>(null),
    [amount, setAmount] = useState(pending?.amount ?? ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [balanceError, setBalanceError] = useState(""),
    [notice, setNotice] = useState("");
  const refreshVersion = useRef(0);
  const depositConfirmed = useRef(false);
  const activeToken = useRef(token);
  activeToken.current = token;
  async function refresh() {
    const version = ++refreshVersion.current;
    setBalanceError("");
    try {
      const balance = await api<Wallet>("/wallet", token);
      if (version === refreshVersion.current && activeToken.current === token) {
        setWallet(balance);
        depositConfirmed.current = false;
      }
    } catch (err) {
      if (version === refreshVersion.current && activeToken.current === token)
        setBalanceError(
          depositConfirmed.current
            ? "Deposit recorded, but the balance could not refresh. Use Refresh balance."
            : message(err),
        );
    }
  }
  useLiveRefresh(() => {
    void refresh();
  }, token);
  useEffect(() => {
    void refresh();
    return () => {
      refreshVersion.current++;
    };
  }, [token]);
  function clearPending() {
    sessionStorage.removeItem(storageKey);
    setPending(null);
  }
  async function deposit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setBalanceError("");
    depositConfirmed.current = false;
    setError("");
    setNotice("");
    const attempt = pending ?? {
      amount: amount.trim(),
      idempotencyKey: crypto.randomUUID(),
    };
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(attempt));
      setPending(attempt);
      await api("/wallet/deposits", token, {
        method: "POST",
        body: JSON.stringify(attempt),
      });
      depositConfirmed.current = true;
      clearPending();
      setAmount("");
      setNotice("Simulated deposit recorded.");
      const version = ++refreshVersion.current;
      try {
        const balance = await api<Wallet>("/wallet", token);
        if (
          version === refreshVersion.current &&
          activeToken.current === token
        ) {
          setWallet(balance);
          depositConfirmed.current = false;
        }
      } catch {
        if (version === refreshVersion.current && activeToken.current === token)
          setBalanceError(
            "Deposit recorded, but the balance could not refresh. Use Refresh balance.",
          );
      }
    } catch (err) {
      if (err instanceof ApiError && [400, 403, 409].includes(err.status))
        clearPending();
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return {
    wallet,
    amount,
    setAmount,
    busy,
    error: error || balanceError,
    notice,
    pending,
    refresh,
    deposit,
  };
}
