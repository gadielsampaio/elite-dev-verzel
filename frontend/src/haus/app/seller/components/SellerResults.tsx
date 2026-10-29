import { useTranslation } from "@/hooks/useTranslation";
import { AppLink } from "@/haus/app/routing/AppLink";
import { LoadingSkeleton } from "../../components/LoadingSkeleton";
import { sellerSectionTitle } from "../typography";
import { RefreshCw, ReceiptText, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { useApiQuery } from "../../../../hooks/useApiQuery";
import { dollars } from "../../../../utils/money";
import type { PageResult } from "../../../../types/pagination";
import type { AccountResult } from "../../../../types/results";
import { useSession } from "../../../../hooks/useSession";
import { Button } from "../../../../components/ui/button";
import { Alert, AlertDescription } from "../../../../components/ui/alert";
import { LotPagination } from "../../components/LotPagination";

function resultLabel(result: AccountResult) {
  if (result.outcome === "settled") return "Sold · Settled";
  if (result.outcome === "pending_settlement") return "Settlement pending";
  if (result.outcome === "no_winner") return "Closed without a winner";
  return result.status;
}

export function SellerResults() {
  const { t } = useTranslation();
  const { session } = useSession();
  const [page, setPage] = useState(1);
  const query = useApiQuery<PageResult<AccountResult>>(
    session?.user.role === "auctioneer"
      ? `/me/auction-results?page=${page}&limit=9`
      : null,
    session?.token,
  );
  return (
    <section className="space-y-6" aria-label={t("Auction results")}>
      <div className="flex items-center justify-between">
        <h2 className={sellerSectionTitle}>{t("Results")}</h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("Reload")}
          title={t("Reload")}
          onClick={query.refresh}
          disabled={query.loading}
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>
      {query.error && (
        <Alert variant="destructive">
          <AlertDescription>{t(query.error)}</AlertDescription>
        </Alert>
      )}
      {query.loading && !query.data && (
        <LoadingSkeleton label={t("Loading results…")} layout="rows" />
      )}
      {query.data?.total === 0 && (
        <p className="border py-12 text-center text-sm text-muted-foreground">
          {t("No completed auctions yet.")}{" "}
        </p>
      )}
      {query.data?.items.map((result) => (
        <article
          key={result.lotId}
          className="grid items-center gap-4 border-b py-6 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
        >
          <div className="min-w-0 space-y-2 break-words">
            <h3 className="font-display text-lg font-medium uppercase leading-snug">
              {result.title}
            </h3>
            <p className="text-xs uppercase text-muted-foreground">
              {t(resultLabel(result))}
            </p>
          </div>
          <p className="text-sm">
            {result.amount !== null
              ? dollars(result.amount, result.currency)
              : "—"}
          </p>
          {result.receiptPath ? (
            <Button
              asChild
              variant="outline"
              size="default"
              className="max-w-full uppercase"
            >
              <AppLink to={`/receipt/${result.lotId}`}>
                <ReceiptText aria-hidden="true" className="shrink-0" />
                {t("Result/Receipt")}{" "}
              </AppLink>
            </Button>
          ) : result.status !== "cancelled" ? (
            <Button
              asChild
              variant="outline"
              size="default"
              className="max-w-full uppercase"
            >
              <AppLink to={`/lot/${result.lotId}`}>
                <ArrowUpRight aria-hidden="true" className="shrink-0" />
                {t("View lot")}{" "}
              </AppLink>
            </Button>
          ) : null}
        </article>
      ))}
      {!!query.data?.total && (
        <LotPagination
          page={page}
          totalPages={Math.ceil(query.data.total / 9)}
          disabled={query.loading}
          onPageChange={setPage}
        />
      )}
    </section>
  );
}
