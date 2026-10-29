import { format } from "date-fns";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { dollars } from "@/utils/money";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { sectionTitle } from "../typography";

type CreditMemo = {
  id: string;
  lotId: string;
  title: string;
  amount: string;
  currency: string;
  createdAt: string;
};

export function CreditMemos({ token }: { token: string }) {
  const { t } = useTranslation();
  const query = useApiQuery<CreditMemo[]>("/wallet/credit-memos", token);
  useLiveRefresh(query.refresh, token);
  if (!query.error && query.data?.length === 0) return null;
  return (
    <section className="space-y-4" aria-labelledby="credit-memos-title">
      <div className="flex items-center justify-between gap-4">
        <h2 id="credit-memos-title" className={sectionTitle}>
          {t("Refunds")}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("Refresh refunds")}
          onClick={query.refresh}
          disabled={query.loading}
        >
          <RefreshCw aria-hidden="true" />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("Reserved funds released after lot cancellation.")}
      </p>
      {query.loading && (
        <LoadingSkeleton label={t("Refunds")} layout="rows" />
      )}
      {query.error && (
        <Alert variant="destructive">
          <AlertDescription>{t(query.error)}</AlertDescription>
        </Alert>
      )}
      <div className="divide-y">
        {query.data?.map((memo) => (
          <article
            key={memo.id}
            className="flex flex-wrap items-start justify-between gap-4 py-4"
          >
            <div className="min-w-0 space-y-2">
              <h3 className="break-words text-sm font-medium">{memo.title}</h3>
              <p className="text-xs text-muted-foreground">
                {format(new Date(memo.createdAt), "dd/MM/yy HH:mm")}
              </p>
              <p className="break-all text-xs text-muted-foreground">
                {t("Refund ID")}: {memo.id}
              </p>
            </div>
            <p className="text-sm font-medium tabular-nums">
              {dollars(memo.amount, memo.currency)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
