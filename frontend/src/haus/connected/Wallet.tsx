import { MoneyInput } from "../../MoneyInput";
import { useWallet } from "../../useWallet";
import { useSession } from "../../session";
import { BackButton } from "../shared";
import { dollars } from "./queries";
export function Wallet() {
  const { session } = useSession();
  if (!session) return null;
  return (
    <WalletContent
      key={session.user.id}
      token={session.token}
      userId={session.user.id}
      bidder={session.user.role === "bidder"}
    />
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
    <section
      className="hs-tools-preview hs-utility-page"
      style={{ display: "block" }}
      id="page-wallet"
      aria-labelledby="wallet-title"
    >
      <BackButton />
      <div className="hs-page-heading">
        <p className="hs-seller-eyebrow">PRIVATE AREA / ACCOUNT</p>
        <h1 id="wallet-title" className="hs-page-title">
          MY WALLET
        </h1>
        <p className="hs-page-lead">
          Available balance is your total balance minus funds committed to
          leading bids.
        </p>
      </div>
      <div className="hs-page-content">
        {wallet ? (
          <div className="hs-wallet-grid">
            {[
              ["TOTAL BALANCE", wallet.total],
              ["COMMITTED BALANCE", wallet.committed],
              ["AVAILABLE BALANCE", wallet.available],
            ].map(([label, value]) => (
              <div key={label}>
                <span className="hs-seller-field">{label}</span>
                <strong>{dollars(value, wallet.currency)}</strong>
              </div>
            ))}
          </div>
        ) : (
          !error && <p role="status">Loading wallet…</p>
        )}
        <button
          className="hs-seller-text-link"
          disabled={busy}
          onClick={() => void refresh()}
        >
          REFRESH BALANCE
        </button>
        {bidder ? (
          <form className="hs-wallet-form" onSubmit={deposit}>
            <h2 className="hs-seller-section-title">SIMULATE A DEPOSIT</h2>
            <p className="hs-seller-notice">
              Funds are recorded in your wallet. No real payment is charged.
            </p>
            <label htmlFor="deposit-amount" className="hs-seller-field">
              DEPOSIT AMOUNT (USD)
            </label>
            <MoneyInput
              id="deposit-amount"
              className="hs-seller-input"
              inputMode="decimal"
              autoComplete="off"
              required
              pattern="(?:0|[1-9][0-9]{0,16})(?:\.[0-9]{1,2})?"
              placeholder="100.00"
              value={amount}
              disabled={busy || !!pending}
              onValueChange={setAmount}
            />
            {pending && (
              <p className="hs-seller-notice">
                A deposit is awaiting confirmation. Retry with the same amount.
              </p>
            )}
            <button
              className="hs-seller-btn ui-action-primary"
              type="submit"
              disabled={busy}
            >
              {busy
                ? "PROCESSING…"
                : pending
                  ? "RETRY DEPOSIT"
                  : "SIMULATE DEPOSIT"}
              <span aria-hidden="true">+</span>
            </button>
          </form>
        ) : (
          <p className="hs-seller-notice">
            Deposits are available to bidder accounts only.
          </p>
        )}
        {notice && (
          <p className="hs-auth-feedback success" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="hs-seller-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
