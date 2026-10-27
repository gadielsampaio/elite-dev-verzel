import { useState, type ReactNode } from "react";
import { current, money, status, useHaus } from "./model";
import { BackButton, MoneyInput } from "./shared";
function UtilityLayout({
  name,
  eyebrow,
  title,
  lead,
  children,
}: {
  name: string;
  eyebrow: string;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <section
      className="hs-tools-preview hs-utility-page"
      style={{ display: "block" }}
      id={`page-${name}`}
      aria-labelledby={`${name}-title`}
    >
      <BackButton />
      <div className="hs-page-heading">
        <p className="hs-seller-eyebrow">{eyebrow}</p>
        <h1 id={`${name}-title`} className="hs-page-title">
          {title}
        </h1>
        <p className="hs-page-lead">{lead}</p>
      </div>
      <div className="hs-page-content">{children}</div>
    </section>
  );
}
export function WalletPage() {
  const { role, wallet, setWallet } = useHaus();
  const [amount, setAmount] = useState(0),
    [feedback, setFeedback] = useState("");
  return (
    <UtilityLayout
      name="wallet"
      eyebrow="PRIVATE AREA / COLLECTOR"
      title="MY WALLET"
      lead="A simulated balance for exploring the auction flow. No real payments."
    >
      <div className="hs-wallet-grid">
        {[
          ["TOTAL BALANCE", wallet[role]],
          ["COMMITTED BALANCE", 0],
          ["AVAILABLE BALANCE", wallet[role]],
        ].map(([label, value]) => (
          <div key={label}>
            <span className="hs-seller-field">{label}</span>
            <strong>{money(Number(value))}</strong>
          </div>
        ))}
      </div>
      <form
        className="hs-wallet-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!role.startsWith("Collector"))
            setFeedback("Select a collector demo account first.");
          else if (amount <= 0)
            setFeedback("Enter a deposit amount greater than zero.");
          else {
            setWallet((w) => ({ ...w, [role]: w[role] + amount }));
            setAmount(0);
            setFeedback("Demo deposit added. No actual payment occurred.");
          }
        }}
      >
        <h2 className="hs-seller-section-title">SIMULATE A DEPOSIT</h2>
        <p className="hs-seller-notice">
          This interaction updates a demo balance only. No payment is made.
        </p>
        <label htmlFor="deposit-amount" className="hs-seller-field">
          DEPOSIT AMOUNT
        </label>
        <MoneyInput
          id="deposit-amount"
          className="hs-seller-input hs-money-input"
          value={amount}
          onValue={setAmount}
        />
        <button className="hs-seller-btn ui-action-primary" type="submit">
          SIMULATE DEPOSIT <span aria-hidden="true">+</span>
        </button>
        <p
          className="hs-seller-error"
          role="status"
          style={{
            color: feedback.startsWith("Demo deposit")
              ? "var(--hs-success)"
              : "var(--hs-danger)",
          }}
        >
          {feedback}
        </p>
      </form>
    </UtilityLayout>
  );
}
export function ActivityPage() {
  const { lots, role } = useHaus(),
    own = lots.filter((l) => l.bids.some((b) => b.person === role));
  return (
    <UtilityLayout
      name="activity"
      eyebrow="PRIVATE AREA / COLLECTOR"
      title="MY BIDS"
      lead="Your participation across the collection. Demonstration data only."
    >
      <div className="hs-panel-heading">
        <h2>MY ACTIVITY</h2>
        <span className="hs-seller-muted">
          {own.length} LOT{own.length === 1 ? "" : "S"}
        </span>
      </div>
      <div aria-live="polite">
        {own.length ? (
          own.map((l) => (
            <div className="hs-utility-row" key={l.id}>
              <div>
                <h3>{l.title}</h3>
                <p>
                  {l.artist} · {l.bids.filter((b) => b.person === role).length}{" "}
                  bid(s) · {status(l).toUpperCase()} ·{" "}
                  {l.bids.at(-1)?.person === role ? "LEADING" : "OUTBID"}
                </p>
              </div>
              <strong>{money(current(l))}</strong>
            </div>
          ))
        ) : (
          <div className="hs-utility-empty">
            No demo bids for this account yet.
          </div>
        )}
      </div>
    </UtilityLayout>
  );
}
export function AuditPage() {
  const { lots } = useHaus();
  return (
    <UtilityLayout
      name="audit"
      eyebrow="TRANSPARENCY / DEMONSTRATION"
      title="PUBLIC AUDIT"
      lead="An illustrative overview of lot activity and visible bid records."
    >
      <div className="hs-panel-heading">
        <h2>LOT RECORDS</h2>
        <span className="hs-seller-muted">PUBLIC VIEW</span>
      </div>
      <div>
        {lots
          .filter((l) => l.status !== "cancelled")
          .map((l) => (
            <div className="hs-utility-row" key={l.id}>
              <div>
                <h3>{l.title}</h3>
                <p>
                  {l.bids.length} demo bid(s) · {status(l).toUpperCase()}
                </p>
              </div>
              <span className="hs-seller-tag">DEMO RECORD</span>
            </div>
          ))}
      </div>
      <p className="hs-seller-notice">
        These are sample records only. An authentic tamper-proof audit requires
        backend validation and immutable records.
      </p>
    </UtilityLayout>
  );
}
