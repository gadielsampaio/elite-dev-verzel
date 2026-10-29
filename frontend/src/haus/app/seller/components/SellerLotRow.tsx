import { useTranslation } from "@/hooks/useTranslation";
import type { OwnedLot } from "../../../../types/seller";
import { AppLink } from "@/haus/app/routing/AppLink";
import { format } from "date-fns";
import { Badge } from "../../../../components/ui/badge";
import { Ban, ReceiptText, LoaderCircle } from "lucide-react";
import { dollars } from "../../../../utils/money";
import { Button } from "../../../../components/ui/button";

export function SellerLotRow({
  lot,
  busy,
  onCancel,
}: {
  lot: OwnedLot;
  busy: string | null;
  onCancel: (lot: OwnedLot) => void;
}) {
  const { t } = useTranslation();
  return (
    <article className="relative grid grid-cols-[80px_minmax(0,1fr)] items-center border border-transparent transition-colors hover:border-border focus-within:border-border motion-reduce:transition-none sm:grid-cols-[160px_minmax(0,1fr)]">
      {lot.status !== "cancelled" && lot.status !== "draft" && (
        <AppLink
          to={`/lot/${lot.id}`}
          aria-label={t("View lot {title}", { title: lot.title })}
          className="absolute inset-0 z-0 focus-visible:outline-2 focus-visible:outline-ring"
        />
      )}
      {lot.items[0]?.imageUrl ? (
        <img
          src={lot.items[0].imageUrl}
          alt=""
          className="aspect-square w-full self-start object-cover object-top"
        />
      ) : (
        <span className="text-xs">{t("No image")}</span>
      )}
      <div className="flex min-w-0 flex-wrap items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <div className="pointer-events-none min-w-0 flex-1 basis-48 space-y-1.5 break-words">
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            <Badge
              variant="outline"
              className="rounded-none px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground"
            >
              {t(lot.status)}
            </Badge>
            <span>
              · {lot.bidCount} {t("bids")}
            </span>
          </div>
          <h3 className="font-display text-sm font-medium uppercase leading-snug tracking-tight sm:text-base">
            {lot.title}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {lot.items[0]?.artistDisplay || "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(lot.startTime), "dd/MM/yy HH:mm")} —{" "}
            {format(new Date(lot.endTime), "dd/MM/yy HH:mm")}
          </p>
          <p className="text-sm">
            <span className="mr-2 text-[10px] uppercase text-muted-foreground">
              {t("Starting bid")}{" "}
            </span>
            <span className="font-medium">
              {dollars(lot.startingBid, lot.currency)}
            </span>
          </p>
        </div>
        <div className="relative z-10 min-w-0 max-w-full">
          <LotActions lot={lot} busy={busy} onCancel={onCancel} />
        </div>
      </div>
    </article>
  );
}

function LotActions({
  lot,
  busy,
  onCancel,
}: {
  lot: OwnedLot;
  busy: string | null;
  onCancel: (lot: OwnedLot) => void;
}) {
  const { t } = useTranslation();
  if (lot.status === "closed") {
    return (
      <Button
        asChild
        variant="outline"
        size="default"
        className="max-w-full text-xs uppercase"
      >
        <AppLink to={`/receipt/${lot.id}`}>
          <ReceiptText aria-hidden="true" className="shrink-0" />
          {t("Result/Receipt")}{" "}
        </AppLink>
      </Button>
    );
  }
  if (!lot.canCancel) return null;

  return (
    <Button
      variant="outline"
      size="default"
      className="max-w-full text-xs uppercase"
      disabled={!!busy}
      onClick={() => onCancel(lot)}
    >
      {busy === lot.id ? (
        <LoaderCircle
          aria-hidden="true"
          className="shrink-0 motion-safe:animate-spin"
        />
      ) : (
        <Ban aria-hidden="true" className="shrink-0" />
      )}
      {busy === lot.id ? t("Cancelling…") : t("Cancel lot")}
    </Button>
  );
}
