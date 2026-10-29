import { useState } from "react";
import { format } from "date-fns";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { Lot } from "@/types/lot";
import type { PageResult } from "@/types/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AppLink } from "../routing/AppLink";
import { LotPagination } from "../components/LotPagination";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { sectionTitle } from "../typography";

export function ClosedLots() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const query = useApiQuery<PageResult<Lot>>(
    `/lots?status=closed&page=${page}&limit=9`,
  );
  return (
    <section className="space-y-6" aria-labelledby="closed-audit-lots">
      <h2 id="closed-audit-lots" className={sectionTitle}>
        {t("Closed lots")}
      </h2>
      {query.loading && (
        <LoadingSkeleton label={t("Loading lots…")} layout="rows" />
      )}
      {query.error && (
        <Alert variant="destructive">
          <AlertDescription>{t(query.error)}</AlertDescription>
          <Button
            variant="outline"
            className="mt-4 uppercase"
            onClick={query.refresh}
          >
            {t("Retry lots")}
          </Button>
        </Alert>
      )}
      {query.data?.total === 0 && (
        <p className="text-sm text-muted-foreground">
          {t("No closed lots yet.")}
        </p>
      )}
      <div className="[&>article:not(:last-child)]:border-b-border">
        {query.data?.items.map((lot) => (
          <ClosedLotRow key={lot.id} lot={lot} />
        ))}
      </div>
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

function ClosedLotRow({ lot }: { lot: Lot }) {
  const { t } = useTranslation();
  const [imageFailed, setImageFailed] = useState(false);
  const item = lot.items[0];
  const auditPath = `/audit/${encodeURIComponent(lot.id)}`;
  return (
    <article className="relative grid grid-cols-[80px_minmax(0,1fr)] items-center border border-transparent transition-colors hover:border-border focus-within:border-border motion-reduce:transition-none sm:grid-cols-[160px_minmax(0,1fr)]">
      <AppLink
        to={auditPath}
        aria-label={t("View audit for {title}", { title: lot.title })}
        className="absolute inset-0 z-0 focus-visible:outline-2 focus-visible:outline-ring"
      />
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
          {t("Image unavailable")}
        </div>
      )}
      <div className="flex min-w-0 flex-wrap items-center gap-4 px-4 py-3 sm:px-6 sm:py-4">
        <div className="pointer-events-none min-w-0 flex-1 basis-48 space-y-2 break-words">
          <Badge
            variant="outline"
            className="rounded-none px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground"
          >
            {t("closed")}
          </Badge>
          <h3 className="font-display text-sm font-medium uppercase leading-snug tracking-tight sm:text-base">
            {lot.title}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {item?.artistDisplay || "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("Ended")}: {format(new Date(lot.endTime), "dd/MM/yy HH:mm")}
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="relative z-10 max-w-full text-xs uppercase"
        >
          <AppLink to={auditPath}>
            <ShieldCheck aria-hidden="true" className="shrink-0" />
            {t("Verify history")}
          </AppLink>
        </Button>
      </div>
    </article>
  );
}
