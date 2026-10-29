import { LoadingSkeleton } from "../LoadingSkeleton";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "../../../components/ui/alert-dialog";
import { format } from "date-fns";
import { sellerSectionTitle } from "./typography";
import { Badge } from "../../../components/ui/badge";
import {
  RefreshCw,
  Ban,
  ReceiptText,
  LoaderCircle,
  ArrowUpRight,
} from "lucide-react";
import { useState } from "react";
import { useSellerLots, type OwnedLot } from "../../data/useSellerLots";
import { useApiQuery, dollars, type PageResult } from "../../data/queries";
import type { AccountResult } from "../../data/results";
import { useSession } from "../../../session";
import { Button } from "../../../components/ui/button";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import { LotPagination } from "../LotPagination";

export function SellerCollection({
  create,
  onChanged,
}: {
  create: () => void;
  onChanged: () => void;
}) {
  const { page, setPage, busy, error, notice, query, cancel } = useSellerLots(
    onChanged,
    false,
    false,
  );
  const [cancellingLot, setCancellingLot] = useState<OwnedLot | null>(null);
  return (
    <section className="space-y-6" aria-label="Your collection">
      <div className="flex items-center justify-between gap-4">
        <h2 className={sellerSectionTitle}>Your collection</h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Reload"
          title="Reload"
          onClick={query.refresh}
          disabled={query.loading}
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Only you can cancel your lots, before any bids are placed.
      </p>
      {(error || query.error) && (
        <Alert variant="destructive">
          <AlertDescription>{error || query.error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert role="status">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {query.loading && !query.data && (
        <LoadingSkeleton label={"Loading your lots…"} layout="rows" />
      )}
      <div className="[&>article:not(:last-child)]:border-b-border">
        {query.data?.items.map((lot) => (
          <article
            key={lot.id}
            className="relative grid grid-cols-[80px_minmax(0,1fr)] items-center border border-transparent transition-colors hover:border-border focus-within:border-border motion-reduce:transition-none sm:grid-cols-[160px_minmax(0,1fr)]"
          >
            {lot.status !== "cancelled" && lot.status !== "draft" && (
              <a
                href={`/#/lot/${lot.id}`}
                aria-label={`View lot ${lot.title}`}
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
              <span className="text-xs">No image</span>
            )}
            <div className="flex min-w-0 flex-wrap items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
              <div className="pointer-events-none min-w-0 flex-1 basis-48 space-y-1.5 break-words">
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                  <Badge
                    variant="outline"
                    className="rounded-none px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground"
                  >
                    {lot.status}
                  </Badge>
                  <span>· {lot.bidCount} bids</span>
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
                    Starting bid
                  </span>
                  <span className="font-medium">
                    {dollars(lot.startingBid, lot.currency)}
                  </span>
                </p>
              </div>
              <div className="relative z-10 min-w-0 max-w-full">
                {lot.status === "closed" ? (
                  <Button
                    asChild
                    variant="outline"
                    size="default"
                    className="max-w-full text-xs uppercase"
                  >
                    <a href={`/#/receipt/${lot.id}`}>
                      <ReceiptText aria-hidden="true" className="shrink-0" />
                      Result/Receipt
                    </a>
                  </Button>
                ) : lot.canCancel ? (
                  <Button
                    variant="outline"
                    size="default"
                    className="max-w-full text-xs uppercase"
                    disabled={!!busy}
                    onClick={() => setCancellingLot(lot)}
                  >
                    {busy === lot.id ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="shrink-0 motion-safe:animate-spin"
                      />
                    ) : (
                      <Ban aria-hidden="true" className="shrink-0" />
                    )}
                    {busy === lot.id ? "Cancelling…" : "Cancel lot"}
                  </Button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
      {query.data?.total === 0 && (
        <div className="space-y-4 border py-12 text-center">
          <p>No lots yet.</p>
          <Button onClick={create} className="uppercase">
            Create a lot
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
            <AlertDialogTitle>Cancel lot?</AlertDialogTitle>
            <AlertDialogDescription>
              Cancel “{cancellingLot?.title}”? It will no longer be available in
              the public collection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep lot</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cancellingLot) void cancel(cancellingLot);
              }}
            >
              Cancel lot
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
export function SellerResults() {
  const { session } = useSession();
  const [page, setPage] = useState(1);
  const query = useApiQuery<PageResult<AccountResult>>(
    session?.user.role === "auctioneer"
      ? `/me/auction-results?page=${page}&limit=9`
      : null,
    session?.token,
  );
  return (
    <section className="space-y-6" aria-label="Auction results">
      <div className="flex items-center justify-between">
        <h2 className={sellerSectionTitle}>Results</h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Reload"
          title="Reload"
          onClick={query.refresh}
          disabled={query.loading}
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>
      {query.error && (
        <Alert variant="destructive">
          <AlertDescription>{query.error}</AlertDescription>
        </Alert>
      )}
      {query.loading && !query.data && (
        <LoadingSkeleton label={"Loading results…"} layout="rows" />
      )}
      {query.data?.total === 0 && (
        <p className="border py-12 text-center text-sm text-muted-foreground">
          No completed auctions yet.
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
              {result.outcome === "settled"
                ? "Sold · Settled"
                : result.outcome === "pending_settlement"
                  ? "Settlement pending"
                  : result.outcome === "no_winner"
                    ? "Closed without a winner"
                    : result.status}
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
              <a href={`/#/receipt/${result.lotId}`}>
                <ReceiptText aria-hidden="true" className="shrink-0" />
                Result/Receipt
              </a>
            </Button>
          ) : result.status !== "cancelled" ? (
            <Button
              asChild
              variant="outline"
              size="default"
              className="max-w-full uppercase"
            >
              <a href={`/#/lot/${result.lotId}`}>
                <ArrowUpRight aria-hidden="true" className="shrink-0" />
                View lot
              </a>
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
