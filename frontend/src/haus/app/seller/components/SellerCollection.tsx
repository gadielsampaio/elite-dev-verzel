import { useTranslation } from "@/hooks/useTranslation";
import { SellerLotRow } from "./SellerLotRow";
import type { OwnedLot } from "../../../../types/seller";
import { LoadingSkeleton } from "../../components/LoadingSkeleton";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "../../../../components/ui/alert-dialog";
import { sellerSectionTitle } from "../typography";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useSellerLots } from "../../../../hooks/useSellerLots";
import { Button } from "../../../../components/ui/button";
import { Alert, AlertDescription } from "../../../../components/ui/alert";
import { LotPagination } from "../../components/LotPagination";

export function SellerCollection({
  create,
  onChanged,
}: {
  create: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { page, setPage, busy, error, notice, query, cancel } = useSellerLots(
    onChanged,
    false,
    false,
  );
  const [cancellingLot, setCancellingLot] = useState<OwnedLot | null>(null);
  return (
    <section className="space-y-6" aria-label={t("Your collection")}>
      <div className="flex items-center justify-between gap-4">
        <h2 className={sellerSectionTitle}>{t("Your collection")}</h2>
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
      <p className="text-sm text-muted-foreground">
        {t("You can cancel your scheduled or live lots. Reserved funds will be released as a refund.")}{" "}
      </p>
      {(error || query.error) && (
        <Alert variant="destructive">
          <AlertDescription>{t(error || query.error)}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert role="status">
          <AlertDescription>{t(notice)}</AlertDescription>
        </Alert>
      )}
      {query.loading && !query.data && (
        <LoadingSkeleton label={t("Loading your lots…")} layout="rows" />
      )}
      <div className="[&>article:not(:last-child)]:border-b-border">
        {query.data?.items.map((lot) => (
          <SellerLotRow
            key={lot.id}
            lot={lot}
            busy={busy}
            onCancel={setCancellingLot}
          />
        ))}
      </div>
      {query.data?.total === 0 && (
        <div className="space-y-4 border py-12 text-center">
          <p>{t("No lots yet.")}</p>
          <Button onClick={create} className="uppercase">
            {t("Create a lot")}{" "}
          </Button>
        </div>
      )}
      <AlertDialog
        open={!!cancellingLot}
        onOpenChange={(open) => {
          if (!open) setCancellingLot(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Cancel lot?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "Cancel “{title}”? It will leave the public collection. Any reserved funds will be released as a refund.",
                { title: cancellingLot?.title ?? "" },
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Keep lot")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cancellingLot) void cancel(cancellingLot);
              }}
            >
              {t("Cancel lot")}{" "}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {!!query.data?.total && (
        <LotPagination
          page={page}
          totalPages={Math.ceil(query.data.total / 9)}
          disabled={query.loading || !!busy}
          onPageChange={setPage}
        />
      )}
    </section>
  );
}
