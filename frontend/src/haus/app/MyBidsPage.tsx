import { LoadingSkeleton } from "./LoadingSkeleton";
import { useState } from "react";
import { format } from "date-fns";
import { ReceiptText, RefreshCw } from "lucide-react";
import { useSession } from "../../session";
import { useApiQuery, dollars, type PageResult } from "../data/queries";
import type { AccountResult } from "../data/results";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../../components/ui/tabs";
import { navigationItemStyles } from "../../components/ui/navigation-item";
import { LotPagination } from "./LotPagination";
import { LiveDot } from "./LiveDot";
import { pageTitle, sectionTitle } from "./typography";

function outcomeLabel(result: AccountResult) {
  if (result.outcome === "settled")
    return result.won ? "Won · Settled" : "Not won · Settled";
  if (result.outcome === "pending_settlement") return "Settlement pending";
  if (result.outcome === "no_winner") return "Closed without a winner";
  return result.status;
}
function ParticipationRow({ result }: { result: AccountResult }) {
  const [imageFailed, setImageFailed] = useState(false);
  const item = result.items[0];
  return (
    <article className="relative grid grid-cols-[80px_minmax(0,1fr)] items-center border border-transparent transition-colors hover:border-border focus-within:border-border motion-reduce:transition-none sm:grid-cols-[160px_minmax(0,1fr)]">
      {result.status !== "cancelled" && (
        <a
          href={`/#/lot/${result.lotId}`}
          aria-label={`View lot ${result.title}`}
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
          Image unavailable
        </div>
      )}
      <div className="flex min-w-0 flex-wrap items-center gap-4 px-4 py-3 sm:px-6 sm:py-4">
        <div className="pointer-events-none min-w-0 flex-1 basis-48 space-y-2 break-words">
          <Badge
            variant="outline"
            className="max-w-full gap-2 whitespace-normal rounded-none px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground"
          >
            {result.status === "open" && <LiveDot />}
            {outcomeLabel(result)}
          </Badge>
          <h3 className="font-display text-sm font-medium uppercase leading-snug tracking-tight sm:text-base">
            {result.title}
          </h3>
          <p className="text-xs text-muted-foreground">
            Ends {format(new Date(result.endTime), "dd/MM/yy HH:mm")}
          </p>
          <dl className="flex flex-wrap gap-x-8 gap-y-3 pt-1">
            {result.myBestBid != null && (
              <div>
                <dt className="text-[10px] uppercase text-muted-foreground">
                  Your highest bid
                </dt>
                <dd className="mt-1 text-sm font-medium">
                  {dollars(result.myBestBid, result.currency)}
                </dd>
              </div>
            )}
            {result.outcome === "settled" && result.amount !== null && (
              <div>
                <dt className="text-[10px] uppercase text-muted-foreground">
                  Settled amount
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
            <a href={`/#/receipt/${encodeURIComponent(result.lotId)}`}>
              <ReceiptText aria-hidden="true" className="shrink-0" />
              Result/Receipt
            </a>
          </Button>
        )}
      </div>
    </article>
  );
}
export function MyBidsPage() {
  const { session } = useSession();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const allowed = session?.user.role === "bidder";
  const query = useApiQuery<PageResult<AccountResult>>(
    allowed ? `/me/participations?page=${page}&limit=9&filter=${filter}` : null,
    session?.token,
  );
  return (
    <section
      className="mx-auto max-w-screen-2xl space-y-10 px-6 py-16 md:px-12 md:py-24"
      aria-labelledby="my-bids-title"
    >
      <header className="space-y-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Private area / Bidder
        </p>
        <h1 id="my-bids-title" className={pageTitle}>
          My bids
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Follow your auction participation, highest bids and confirmed wins.
        </p>
      </header>
      {!allowed ? (
        <div className="space-y-6">
          <Alert>
            <AlertDescription>
              {session
                ? "A bidder account is required to view My bids."
                : "Sign in as a bidder to view your bids."}
            </AlertDescription>
          </Alert>
          {!session && (
            <Button asChild className="uppercase">
              <a href="/#/login">Log in</a>
            </Button>
          )}
        </div>
      ) : (
        <Tabs
          value={filter}
          onValueChange={(value) => {
            setPage(1);
            setFilter(value);
          }}
          className="flex flex-col gap-8"
        >
          <TabsList
            aria-label="Participation filter"
            className="h-auto w-full justify-start gap-6 rounded-none border-b bg-transparent p-0"
          >
            <TabsTrigger value="all" className={navigationItemStyles}>
              All participation
            </TabsTrigger>
            <TabsTrigger value="wins" className={navigationItemStyles}>
              My wins
            </TabsTrigger>
          </TabsList>
          <TabsContent value={filter} className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <h2 className={sectionTitle}>
                {filter === "wins" ? "Confirmed wins" : "Your auctions"}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Refresh bids"
                title="Refresh bids"
                className="shrink-0"
                disabled={query.loading}
                onClick={query.refresh}
              >
                <RefreshCw aria-hidden="true" />
              </Button>
            </div>
            {query.loading && (
              <LoadingSkeleton label={"Loading your bids…"} layout="rows" />
            )}
            {query.error && (
              <Alert variant="destructive">
                <AlertDescription>{query.error}</AlertDescription>
              </Alert>
            )}
            {query.data?.items.length === 0 && (
              <div className="border px-6 py-12 text-center text-sm text-muted-foreground">
                {filter === "wins"
                  ? "No confirmed wins yet."
                  : "You haven’t placed any bids yet."}
              </div>
            )}
            <div className="[&>article:not(:last-child)]:border-b-border">
              {query.data?.items.map((result) => (
                <ParticipationRow key={result.lotId} result={result} />
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
            <p className="text-xs leading-relaxed text-muted-foreground">
              Only completed settlements count as confirmed wins. Receipts use
              simulated funds.
            </p>
          </TabsContent>
        </Tabs>
      )}
    </section>
  );
}
