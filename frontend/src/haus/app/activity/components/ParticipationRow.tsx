import { useTranslation } from "@/hooks/useTranslation";
import { AppLink } from "@/haus/app/routing/AppLink";
import { useState } from "react";
import { format } from "date-fns";
import { ReceiptText } from "lucide-react";
import { dollars } from "@/utils/money";
import type { AccountResult } from "@/types/results";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveDot } from "@/haus/app/components/LiveDot";

function outcomeLabel(result: AccountResult) {
  if (result.outcome === "settled")
    return result.won ? "Won · Settled" : "Not won · Settled";
  if (result.outcome === "pending_settlement") return "Settlement pending";
  if (result.outcome === "no_winner") return "Closed without a winner";
  return result.status;
}
export function ParticipationRow({ result }: { result: AccountResult }) {
  const { t } = useTranslation();
  const [imageFailed, setImageFailed] = useState(false);
  const item = result.items[0];
  return (
    <article className="relative grid grid-cols-[80px_minmax(0,1fr)] items-center border border-transparent transition-colors hover:border-border focus-within:border-border motion-reduce:transition-none sm:grid-cols-[160px_minmax(0,1fr)]">
      {result.status !== "cancelled" && (
        <AppLink
          to={`/lot/${result.lotId}`}
          aria-label={t("View lot {title}", { title: result.title })}
          className="absolute inset-0 z-0 focus-visible:outline-2 focus-visible:outline-ring"
        />
      )}
      {item?.imageUrl && !imageFailed ? (
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="aspect-square w-full self-start object-cover object-top"
        />
      ) : (
        <div className="flex aspect-square items-center justify-center p-2 text-center text-[10px] uppercase text-muted-foreground">
          {t("Image unavailable")}{" "}
        </div>
      )}
      <div className="flex min-w-0 flex-wrap items-center gap-4 px-4 py-3 sm:px-6 sm:py-4">
        <div className="pointer-events-none min-w-0 flex-1 basis-48 space-y-2 break-words">
          <Badge
            variant="outline"
            className="max-w-full gap-2 whitespace-normal rounded-none px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground"
          >
            {result.status === "open" && <LiveDot />}
            {t(outcomeLabel(result))}
          </Badge>
          <h3 className="font-display text-sm font-medium uppercase leading-snug tracking-tight sm:text-base">
            {result.title}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("Ends")} {format(new Date(result.endTime), "dd/MM/yy HH:mm")}
          </p>
          <dl className="flex flex-wrap gap-x-8 gap-y-3 pt-1">
            {result.myBestBid != null && (
              <div>
                <dt className="text-[10px] uppercase text-muted-foreground">
                  {t("Your highest bid")}{" "}
                </dt>
                <dd className="mt-1 text-sm font-medium">
                  {dollars(result.myBestBid, result.currency)}
                </dd>
              </div>
            )}
            {result.outcome === "settled" && result.amount !== null && (
              <div>
                <dt className="text-[10px] uppercase text-muted-foreground">
                  {t("Settled amount")}{" "}
                </dt>
                <dd className="mt-1 text-sm font-medium">
                  {dollars(result.amount, result.currency)}
                </dd>
              </div>
            )}
          </dl>
        </div>
        {result.receiptPath && (
          <Button
            asChild
            variant="outline"
            size="default"
            className="relative z-10 max-w-full text-xs uppercase"
          >
            <AppLink to={`/receipt/${encodeURIComponent(result.lotId)}`}>
              <ReceiptText aria-hidden="true" className="shrink-0" />
              {t("Result/Receipt")}{" "}
            </AppLink>
          </Button>
        )}
      </div>
    </article>
  );
}
