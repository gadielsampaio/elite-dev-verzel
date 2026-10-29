import { LoadingSkeleton } from "./LoadingSkeleton";
import { returnLot, returnToLot, lotHref } from "./room/navigation";
import { toast } from "sonner";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, RefreshCw, LoaderCircle } from "lucide-react";
import { useSession } from "../../session";
import { useWallet } from "../../useWallet";
import { MoneyInput } from "../../MoneyInput";
import { dollars } from "../data/queries";
import { Button } from "../../components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "../../components/ui/alert";
import { FieldError } from "../../components/ui/field";
import { pageTitle } from "./typography";

export function WalletPage() {
  const { session } = useSession();
  if (!session)
    return (
      <section className="mx-auto max-w-screen-2xl space-y-6 px-6 py-16 md:px-12 md:py-24">
        <h1 className={pageTitle}>My wallet</h1>
        <Alert>
          <AlertDescription>Sign in to view your wallet.</AlertDescription>
        </Alert>
        <Button asChild className="uppercase">
          <a href="/#/login">Log in</a>
        </Button>
      </section>
    );
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
  const lotId = returnLot();
  useEffect(() => {
    if (notice)
      toast.success("Deposit recorded", {
        id: `wallet-deposit-${userId}`,
        description: notice,
      });
  }, [notice, userId]);
  useEffect(
    () => () => {
      if (!lotId) toast.dismiss(`wallet-deposit-${userId}`);
    },
    [userId, lotId],
  );
  useEffect(() => {
    if (notice && lotId) returnToLot(lotId);
  }, [notice, lotId]);
  const [fieldError, setFieldError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  async function reload() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !pending &&
      !/^(?!0+(?:\.0{1,2})?$)\d{1,17}(?:\.\d{1,2})?$/.test(amount)
    ) {
      setFieldError("Enter an amount greater than $0.00.");
      event.currentTarget
        .querySelector<HTMLInputElement>("#wallet-deposit")
        ?.focus();
      return;
    }
    setFieldError("");
    void deposit(event);
  }
  return (
    <section
      className="mx-auto max-w-screen-2xl space-y-10 px-6 py-16 md:px-12 md:py-24"
      aria-labelledby="wallet-title"
    >
      {lotId && (
        <Alert>
          <AlertDescription>
            Add funds to continue bidding. After a confirmed deposit, you’ll
            return to the lot to submit your bid.
            <Button asChild variant="link" className="uppercase">
              <a href={lotHref(lotId)}>Return to lot</a>
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <header className="space-y-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Private area / Account
        </p>
        <h1 id="wallet-title" className={pageTitle}>
          My wallet
        </h1>
        <div className="flex items-start justify-between gap-6">
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Available balance is your total balance minus funds committed to
            leading bids.
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label="Refresh balance"
            title="Refresh balance"
            onClick={() => void reload()}
            disabled={busy || refreshing}
          >
            <RefreshCw
              aria-hidden="true"
              className={refreshing ? "motion-safe:animate-spin" : undefined}
            />
          </Button>
        </div>
      </header>
      {!wallet && !error && (
        <LoadingSkeleton label={"Loading wallet…"} layout="detail" />
      )}
      <dl
        className="grid gap-px border-y bg-border md:grid-cols-3"
        aria-label="Wallet balances"
      >
        {[
          ["Total balance", wallet?.total],
          ["Committed balance", wallet?.committed],
          ["Available balance", wallet?.available],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 space-y-3 bg-background p-6">
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {label}
            </dt>
            <dd
              className={`break-words font-display text-2xl tracking-tight lg:text-3xl ${label === "Available balance" ? "font-semibold" : "font-medium"}`}
            >
              {value !== undefined ? dollars(value, wallet?.currency) : "—"}
            </dd>
          </div>
        ))}
      </dl>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {bidder ? (
        <div className="mx-auto w-full max-w-lg">
          <form
            noValidate
            onSubmit={submit}
            className="min-w-0 space-y-6"
            aria-label="Simulate a deposit"
            aria-busy={busy}
          >
            <div className="space-y-2">
              <label
                htmlFor="wallet-deposit"
                className="block text-xs uppercase"
              >
                Deposit amount (USD)
              </label>
              <MoneyInput
                id="wallet-deposit"
                name="amount"
                autoComplete="off"
                value={amount}
                onValueChange={(value) => {
                  setAmount(value);
                  setFieldError("");
                }}
                disabled={busy || !!pending}
                aria-invalid={!!fieldError}
                aria-describedby={
                  fieldError ? "wallet-deposit-error" : "wallet-deposit-help"
                }
                className="h-12 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              />
              <FieldError id="wallet-deposit-error">{fieldError}</FieldError>
              <p
                id="wallet-deposit-help"
                className="text-xs leading-relaxed text-muted-foreground"
              >
                Enter an amount in USD. Funds are simulated.
              </p>
            </div>
            {pending && (
              <Alert role="status">
                <AlertTitle>Awaiting confirmation</AlertTitle>
                <AlertDescription>
                  Retry the same deposit to confirm it. The amount is locked to
                  prevent a duplicate payment.
                </AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              disabled={busy}
              className="h-12 w-full uppercase"
            >
              {busy ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="motion-safe:animate-spin"
                />
              ) : (
                <Plus aria-hidden="true" />
              )}
              {busy
                ? "Processing…"
                : pending
                  ? "Retry deposit"
                  : "Simulate deposit"}
            </Button>
          </form>
        </div>
      ) : (
        <Alert role="status">
          <AlertDescription>
            Deposits are available to bidder accounts only.
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}
