import { useEffect, useState, type FormEvent } from "react";
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
    [notice, setNotice] = useState("");
  async function refresh() {
    setError("");
    try {
      setWallet(await api<Wallet>("/wallet", token));
    } catch (err) {
      setError(message(err));
    }
  }
  useEffect(() => {
    let active = true;
    api<Wallet>("/wallet", token)
      .then((data) => {
        if (active) setWallet(data);
      })
      .catch((err) => {
        if (active) setError(message(err));
      });
    return () => {
      active = false;
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
      clearPending();
      setAmount("");
      setNotice("Simulated deposit recorded.");
      try {
        setWallet(await api<Wallet>("/wallet", token));
      } catch {
        setError(
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
    error,
    notice,
    pending,
    refresh,
    deposit,
  };
}
