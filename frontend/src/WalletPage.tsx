import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { api, ApiError, message, money, type Wallet } from "./api";
import { useSession } from "./session";

type Pending = { amount: string; idempotencyKey: string };
export function WalletPage() {
  const { session } = useSession();
  return session ? (
    <WalletContent
      key={session.user.id}
      token={session.token}
      userId={session.user.id}
      bidder={session.user.role === "bidder"}
    />
  ) : (
    <Navigate to="/login" replace />
  );
}
function WalletContent({
  token,
  userId,
  bidder,
}: {
  token: string;
  userId: string;
  bidder: boolean;
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
  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR WALLET</p>
          <h1>
            A little room
            <br />
            for your next find.
          </h1>
        </div>
        <button className="secondary" disabled={busy} onClick={refresh}>
          Refresh balance
        </button>
      </div>
      {wallet ? (
        <div className="balances">
          {[
            ["Total balance", wallet.total],
            ["Committed to bids", wallet.committed],
            ["Available balance", wallet.available],
          ].map(([label, value]) => (
            <div className="panel" key={label}>
              <p>{label}</p>
              <strong>{money(value, wallet.currency)}</strong>
            </div>
          ))}
        </div>
      ) : (
        !error && <p role="status">Loading wallet…</p>
      )}
      <div className="panel deposit">
        <h2>{bidder ? "Add simulated funds" : "Your auction balance"}</h2>
        <p>
          {bidder
            ? "For the auction demo only. No real money is charged."
            : "Deposits are available to bidder accounts only. Settlement is not available yet."}
        </p>
        {bidder && (
          <form onSubmit={deposit}>
            <label>
              Amount (USD)
              <input
                required
                inputMode="decimal"
                pattern="(?:0|[1-9][0-9]{0,16})(?:\.[0-9]{1,2})?"
                value={amount}
                disabled={busy || !!pending}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100.00"
              />
            </label>
            {pending && (
              <p className="notice">
                A deposit is awaiting confirmation. Retry safely with the same
                amount.
              </p>
            )}
            <button disabled={busy}>
              {busy ? "Processing…" : pending ? "Retry deposit" : "Add funds"}
            </button>
          </form>
        )}
        {notice && (
          <p role="status" className="success">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>
      <p className="footnote">
        Available balance = total balance − committed balance. Bid reservations
        are not active yet.
      </p>
    </section>
  );
}
