import { useTranslation } from "@/hooks/useTranslation";
import { receiptLabel, receiptStatusMessages } from "./presentation";
import { AppLink } from "@/haus/app/routing/AppLink";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { useSession } from "../../../hooks/useSession";
import { useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { format } from "date-fns";
import { Copy, RefreshCw, ShieldCheck, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { useApiQuery } from "../../../hooks/useApiQuery";
import { dollars } from "../../../utils/money";
import type { Result } from "../../../types/results";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Badge } from "../../../components/ui/badge";
import { pageTitle, sectionTitle } from "../typography";

export function ReceiptPage() {
  const { lotId } = useParams();
  return <ReceiptContent key={lotId ?? "missing"} lotId={lotId ?? null} />;
}

function ReceiptContent({ lotId }: { lotId: string | null }) {
  const { t } = useTranslation();
  const { session } = useSession();
  const [searchParams] = useSearchParams();
  const sharedToken = searchParams.get("share");
  const query = useApiQuery<Result>(
    lotId && (session || sharedToken)
      ? `/lots/${encodeURIComponent(lotId)}/receipt${sharedToken ? "/shared" : ""}`
      : null,
    sharedToken ? undefined : session?.token,
    false,
    false,
    sharedToken ? { "X-Receipt-Token": sharedToken } : undefined,
  );
  const result = query.data;
  const receipt = result?.status === "settled" ? result.receipt : null;
  const [copyError, setCopyError] = useState("");
  const [copying, setCopying] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const shareUrl = lotId && receipt?.shareToken
    ? `${location.origin}/#/receipt/${encodeURIComponent(lotId)}?share=${encodeURIComponent(receipt.shareToken)}`
    : "";
  async function copy() {
    setCopying(true);
    setCopyError("");
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(t("Receipt link copied"));
    } catch {
      setCopyError(
        t("Could not copy the link. Select the link and copy it manually."),
      );
    } finally {
      setCopying(false);
    }
  }
  return (
    <section
      className="mx-auto max-w-screen-2xl space-y-10 px-6 py-16 md:px-12 md:py-24"
      aria-labelledby="receipt-title"
    >
      <header className="space-y-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {t("Private records / Auction receipt")}{" "}
        </p>
        <div className="flex items-start justify-between gap-4">
          <h1 id="receipt-title" className={pageTitle}>
            {t("Receipt")}{" "}
          </h1>
          {lotId && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("Refresh result")}
              title={t("Refresh result")}
              disabled={query.loading}
              className="shrink-0"
              onClick={query.refresh}
            >
              <RefreshCw aria-hidden="true" />
            </Button>
          )}
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t(
            "Settlement details for the winner, lot owner, and anyone with the shared receipt link.",
          )}{" "}
        </p>
      </header>
      {!session && !sharedToken && (
        <Alert>
          <AlertDescription>
            {t(
              "Sign in as the winning bidder or lot owner to view this receipt.",
            )}{" "}
            <Button asChild variant="link" className="uppercase">
              <AppLink
                to={`/login${lotId ? "?receipt=" + encodeURIComponent(lotId) : ""}`}
              >
                {t("Log in")}{" "}
              </AppLink>
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {!lotId && (
        <Alert>
          <AlertDescription>
            {t(
              "Open a receipt link from My Bids, Seller Studio or an auction room.",
            )}{" "}
          </AlertDescription>
        </Alert>
      )}
      {query.loading && (
        <LoadingSkeleton label={t("Loading auction result…")} layout="detail" />
      )}
      {query.error && (
        <Alert variant="destructive">
          <AlertDescription>{t(query.error)}</AlertDescription>
        </Alert>
      )}
      {result && (
        <div className="space-y-8">
          <div className="flex items-center gap-6 border-y py-6">
            {result.items[0]?.imageUrl && !imageFailed && (
              <img
                src={result.items[0].imageUrl}
                alt={result.items[0].name}
                onError={() => setImageFailed(true)}
                className="size-20 shrink-0 object-cover object-top sm:size-28"
              />
            )}
            <div className="min-w-0 space-y-3">
              <Badge
                variant="outline"
                className="rounded-none text-[10px] font-normal uppercase"
              >
                {t(receiptLabel(result))}
              </Badge>
              <h2 className={sectionTitle}>{result.title}</h2>
              <p className="break-all text-[10px] uppercase text-muted-foreground">
                {t("Lot")} {result.lotId}
              </p>
            </div>
          </div>
          {receipt ? (
            <>
              <section
                className="space-y-6"
                aria-labelledby="settled-receipt-title"
              >
                <h3
                  id="settled-receipt-title"
                  className="font-display text-xl font-semibold uppercase tracking-tight"
                >
                  {t("Settled receipt")}{" "}
                </h3>
                <dl className="grid gap-px border-y bg-border sm:grid-cols-2">
                  <div className="min-w-0 space-y-3 bg-background p-6">
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t("Settled amount")}{" "}
                    </dt>
                    <dd className="break-words font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                      {dollars(receipt.amount, result.currency)}
                    </dd>
                  </div>
                  <div className="min-w-0 space-y-3 bg-background p-6">
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t("Winner")}{" "}
                    </dt>
                    <dd className="break-all text-sm">{receipt.winnerAlias}</dd>
                  </div>
                  {[
                    [t("Ended"), receipt.endedAt],
                    [t("Settled"), receipt.settledAt],
                  ].map(([label, date]) => (
                    <div key={label} className="space-y-3 bg-background p-6">
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {label}
                      </dt>
                      <dd className="text-sm">
                        {format(new Date(date), "dd/MM/yy HH:mm")}
                      </dd>
                    </div>
                  ))}
                </dl>
                <dl className="grid gap-4 text-xs sm:grid-cols-2">
                  {[
                    [t("Receipt ID"), receipt.id],
                    [t("Winning bid ID"), receipt.winningBidId],
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0 space-y-2">
                      <dt className="text-[10px] uppercase text-muted-foreground">
                        {label}
                      </dt>
                      <dd className="break-all">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t(
                    "Times use your device’s local time zone. This receipt records a simulated auction settlement; it is not proof of bid-history integrity. Use Public Audit to verify that history.",
                  )}{" "}
                </p>
              </section>
              <div className="space-y-3">
                <label
                  htmlFor="receipt-share-link"
                  className="block text-xs uppercase"
                >
                  {t("Shareable receipt link")}{" "}
                </label>
                <div className="flex gap-2">
                  <Input
                    id="receipt-share-link"
                    readOnly
                    value={shareUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="h-12 min-w-0"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-12 shrink-0"
                    aria-label={t("Copy receipt link")}
                    title={t("Copy receipt link")}
                    disabled={copying}
                    onClick={() => void copy()}
                  >
                    <Copy aria-hidden="true" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("Anyone with this link can view the receipt. Share it only with people you choose.")}
                </p>
                {copyError && (
                  <Alert variant="destructive">
                    <AlertDescription>{t(copyError)}</AlertDescription>
                  </Alert>
                )}
              </div>
            </>
          ) : (
            <Alert role="status">
              <AlertDescription>
                {t(receiptStatusMessages[result.status])}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
      {lotId && (
        <div className="flex flex-wrap gap-3 border-t pt-6">
          <Button asChild className="h-12 uppercase">
            <AppLink to={`/audit/${encodeURIComponent(lotId)}`}>
              <ShieldCheck aria-hidden="true" />
              {t("Verify bid history")}{" "}
            </AppLink>
          </Button>
          {result && (
            <Button asChild variant="outline" className="h-12 uppercase">
              <AppLink to={`/lot/${encodeURIComponent(lotId)}`}>
                <ArrowUpRight aria-hidden="true" />
                {t("View lot")}{" "}
              </AppLink>
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
