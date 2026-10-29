import { useLiveRefresh } from "./useLiveRefresh";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { hasApiStatus } from "../api/errors";
import { message } from "../utils/errors";
import type { Wallet } from "../types/wallet";
import type { PendingAmount } from "../types/pendingAmount";
import { readPendingAmount } from "../utils/pendingAmount";

const REJECTED_DEPOSIT_STATUSES = [400, 403, 409];
const BALANCE_REFRESH_NOTICE =
  "Deposit recorded, but the balance could not refresh. Use Refresh balance.";

export function useWallet({
  token,
  userId,
}: {
  token: string;
  userId: string;
}) {
  const storageKey = `pending-deposit:${userId}`;
  const [pending, setPending] = useState<PendingAmount | null>(
    () => readPendingAmount(storageKey),
  );
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [amount, setAmount] = useState(pending?.amount ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [balanceError, setBalanceError] = useState("");
  const [notice, setNotice] = useState("");
  const refreshVersion = useRef(0);
  const depositConfirmed = useRef(false);
  const activeToken = useRef(token);
  activeToken.current = token;

  function isCurrentBalanceRequest(version: number) {
    return version === refreshVersion.current && activeToken.current === token;
  }

  async function loadBalance(failureNotice?: string) {
    const version = ++refreshVersion.current;

    try {
      const balance = await api<Wallet>("/wallet", token);
      if (!isCurrentBalanceRequest(version)) return;

      setWallet(balance);
      depositConfirmed.current = false;
    } catch (error) {
      if (!isCurrentBalanceRequest(version)) return;

      const fallback = depositConfirmed.current ? BALANCE_REFRESH_NOTICE : message(error);
      setBalanceError(failureNotice ?? fallback);
    }
  }

  async function refresh() {
    setBalanceError("");
    await loadBalance();
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
      await loadBalance(BALANCE_REFRESH_NOTICE);
    } catch (err) {
      if (hasApiStatus(err, REJECTED_DEPOSIT_STATUSES)) clearPending();

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
