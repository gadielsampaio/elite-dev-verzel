import { MoneyInput } from "./MoneyInput";
import { Navigate } from "react-router-dom";
import { money } from "./api";
import { useWallet } from "./useWallet";
import { useSession } from "./session";

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
  const {
    wallet,
    amount,
    setAmount,
    busy,
    error,
    notice,
    pending,
    refresh,
    deposit,
  } = useWallet({ token, userId });
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
              <MoneyInput
                required
                inputMode="decimal"
                pattern="(?:0|[1-9][0-9]{0,16})(?:\.[0-9]{1,2})?"
                value={amount}
                disabled={busy || !!pending}
                onValueChange={setAmount}
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
        Available balance = total balance − committed balance. Leading bids
        reserve funds. Settlement is not available yet.
      </p>
    </section>
  );
}
