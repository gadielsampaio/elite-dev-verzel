import { LoadingSkeleton } from "../LoadingSkeleton";
import { useEffect, useRef, useState } from "react";
import { RefreshCw, ShieldCheck, ReceiptText } from "lucide-react";
import { format } from "date-fns";
import { useSession } from "../../../session";
import type { Lot } from "../../../api";
import type { Result } from "../../data/results";
import { useApiQuery, dollars, type BidSummary } from "../../data/queries";
import { useRoomImage } from "../../data/useRoomImage";
import { useLiveRefresh } from "../../data/useLiveRefresh";
import { useHaus, clock } from "../../model";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../../../components/ui/tabs";
import { navigationItemStyles } from "../../../components/ui/navigation-item";
import {
  Table,
  TableBody,
  TableRow,
  TableCell,
} from "../../../components/ui/table";
import { pageTitle } from "../typography";
import { LotPagination } from "../LotPagination";
import { LiveDot } from "../LiveDot";
import { ArtworkViewer } from "./ArtworkViewer";
import { RoomBidForm } from "./RoomBidForm";
type Position = {
  bidderAlias: string;
  bestBid: unknown;
  isLeading: boolean;
  position: number | null;
};
const readId = () => location.hash.match(/^#\/lot\/([^/?]+)$/)?.[1] ?? "";
export function AuctionRoom() {
  const [id, setId] = useState(readId);
  useEffect(() => {
    const update = () => setId(readId());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return <Room key={id} id={id} />;
}
function Room({ id }: { id: string }) {
  const { session } = useSession(),
    { now } = useHaus();
  const [page, setPage] = useState(1);
  const detail = useApiQuery<Lot>(
    `/lots/${encodeURIComponent(id)}`,
    undefined,
    true,
  );
  const history = useApiQuery<BidSummary>(
    detail.data
      ? `/lots/${encodeURIComponent(id)}/bids?page=${page}&limit=20`
      : null,
    undefined,
    true,
  );
  const position = useApiQuery<Position>(
    detail.data && session?.user.role === "bidder"
      ? `/lots/${encodeURIComponent(id)}/bids/me`
      : null,
    session?.token,
    true,
  );
  const lot = detail.data,
    bids = history.data,
    item = lot?.items[0];
  const closed = bids?.status === "closed" || lot?.status === "closed";
  const result = useApiQuery<Result>(
    closed ? `/lots/${encodeURIComponent(id)}/result` : null,
    session?.token,
    true,
  );
  const received = useRef({ data: bids, at: now });
  if (received.current.data !== bids)
    received.current = { data: bids, at: now };
  const serverNow = bids
    ? Date.parse(bids.serverTime) + now - received.current.at
    : now;
  const elapsed =
    !!bids && bids.status === "open" && serverNow >= Date.parse(bids.endTime);
  const open = !!bids && bids.status === "open" && !closed && !elapsed;
  const refresh = () => {
    detail.refresh();
    history.refresh();
    position.refresh();
    result.refresh();
  };
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (!bids || !lot || closed) return;
    const boundary = bids.status === "scheduled" ? lot.startTime : bids.endTime;
    const delay = Math.min(
      2147483647,
      Math.max(100, Date.parse(boundary) - serverNow + 100),
    );
    const timer = setTimeout(() => refreshRef.current(), delay);
    return () => clearTimeout(timer);
  }, [bids, lot?.startTime, closed]);
  const connected = useLiveRefresh(() => {}, session?.token, id);
  const image = useRoomImage(item?.imageUrl, item?.printImageUrl);
  const settled = result.data?.status === "settled";
  const participated = !!position.data?.bestBid;
  const won =
    settled &&
    !!position.data?.bidderAlias &&
    position.data.bidderAlias === result.data?.winnerAlias;
  return (
    <section>
      {!lot && (
        <header className="space-y-4 px-6 py-12">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            The auction room
          </p>
          <h1 className={pageTitle}>
            {detail.error ? "Lot unavailable" : "Loading lot…"}
          </h1>
          {detail.loading && (
            <LoadingSkeleton label="Loading lot…" layout="hero" />
          )}
          {item && (
            <p className="text-sm text-muted-foreground">
              {item.artistDisplay || "Artist not listed"}
            </p>
          )}
        </header>
      )}
      {!lot &&
        [detail.error, history.error, position.error, result.error]
          .filter(Boolean)
          .map((error, i) => (
            <Alert key={i} variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ))}
      {lot && (
        <ArtworkViewer
          image={image}
          preview={item?.imageUrl}
          title={lot.title}
          artist={item?.artistDisplay || "Artist not listed"}
          year={item?.sourceSnapshot?.dateDisplay || "—"}
          provider={item?.sourceSnapshot?.provider}
        >
          <Card className="min-w-0 rounded-none py-0 shadow-none">
            <CardContent className="space-y-6 p-5 sm:p-6">
              {[detail.error, history.error, position.error, result.error]
                .filter(Boolean)
                .map((error, i) => (
                  <Alert key={i} variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ))}
              <Tabs defaultValue="bid" className="gap-6">
                <TabsList
                  aria-label="Auction room sections"
                  className="h-auto w-full justify-start gap-5 overflow-x-auto rounded-none border-b bg-transparent p-0"
                >
                  <TabsTrigger value="bid" className={navigationItemStyles}>
                    Bid
                  </TabsTrigger>
                  <TabsTrigger value="history" className={navigationItemStyles}>
                    History
                  </TabsTrigger>
                  <TabsTrigger value="details" className={navigationItemStyles}>
                    Artwork details
                  </TabsTrigger>
                </TabsList>
                <div className="flex items-center justify-between gap-4">
                  <p className="flex items-center gap-2 text-xs uppercase tracking-wider">
                    {open && <LiveDot />}
                    {closed
                      ? "Auction closed"
                      : elapsed
                        ? "Bidding ended"
                        : bids?.status === "scheduled"
                          ? "Upcoming"
                          : open
                            ? "Live now"
                            : "Loading auction…"}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Refresh lot"
                    onClick={refresh}
                  >
                    <RefreshCw aria-hidden="true" />
                  </Button>
                </div>
                <dl className="grid grid-cols-2 gap-4 border-y py-5">
                  <div className="min-w-0 space-y-2">
                    <dt className="text-[10px] uppercase text-muted-foreground">
                      {closed || elapsed ? "Last bid" : "Current bid"}
                    </dt>
                    <dd className="break-words font-display text-xl tracking-tight">
                      {bids
                        ? dollars(
                            bids.currentBid ?? bids.startingBid,
                            bids.currency,
                          )
                        : "—"}
                    </dd>
                  </div>
                  <div className="space-y-2">
                    <dt className="text-[10px] uppercase text-muted-foreground">
                      Time remaining
                    </dt>
                    <dd className="font-display text-xl tracking-tight">
                      {open
                        ? clock(Date.parse(bids!.endTime), serverNow)
                        : closed || elapsed
                          ? "Ended"
                          : bids?.status === "scheduled"
                            ? "Upcoming"
                            : "—"}
                    </dd>
                  </div>
                </dl>
                {(closed || elapsed) && (
                  <Alert
                    role="status"
                    className={
                      settled && participated
                        ? won
                          ? "border-success text-success"
                          : "border-destructive text-destructive"
                        : undefined
                    }
                  >
                    <AlertDescription>
                      {settled
                        ? participated
                          ? won
                            ? "You won this auction. Settlement is complete."
                            : "You did not win this auction. Settlement is complete."
                          : "This auction has settled."
                        : result.data?.status === "no_winner"
                          ? "Closed without a winner. No funds were transferred."
                          : "Bidding has ended. The final result is awaiting confirmation."}
                    </AlertDescription>
                  </Alert>
                )}
                <TabsContent
                  value="bid"
                  forceMount
                  className="space-y-5 data-[state=inactive]:hidden"
                >
                  {open ? (
                    session?.user.role === "bidder" ? (
                      <>
                        <p className="text-xs uppercase text-muted-foreground">
                          {position.data?.isLeading
                            ? "You are currently leading"
                            : participated
                              ? "You have been outbid"
                              : "Place your bid"}
                        </p>
                        <RoomBidForm
                          key={session.user.id}
                          lotId={id}
                          userId={session.user.id}
                          token={session.token}
                          minimum={bids!.minimumNextBid}
                          currency={lot.currency}
                          eligible={
                            !!position.data &&
                            !position.error &&
                            !history.error &&
                            !position.data.isLeading
                          }
                          refresh={refresh}
                        />
                      </>
                    ) : session ? (
                      <Alert>
                        <AlertDescription>
                          Only bidder accounts can place bids.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <>
                        <p className="text-xs uppercase text-muted-foreground">
                          Sign in to bid
                        </p>
                        <div className="space-y-4">
                          <p className="text-xs text-muted-foreground">
                            Minimum next bid:{" "}
                            {dollars(
                              bids!.minimumNextBid ?? bids!.startingBid,
                              lot.currency,
                            )}
                          </p>
                          <label
                            htmlFor="guest-bid"
                            className="block text-xs uppercase"
                          >
                            Bid amount ({lot.currency})
                          </label>
                          <Input
                            id="guest-bid"
                            disabled
                            placeholder="Log in to place a bid"
                            className="h-12 w-full border bg-transparent px-3 text-right text-sm disabled:opacity-50"
                          />
                          <Button asChild className="h-12 w-full uppercase">
                            <a href={`/#/login?lot=${encodeURIComponent(id)}`}>
                              Login
                            </a>
                          </Button>
                        </div>
                      </>
                    )
                  ) : !closed && !elapsed ? (
                    <p className="text-sm text-muted-foreground">
                      {bids?.status === "scheduled"
                        ? "Bidding opens at " +
                          format(new Date(lot.startTime), "dd/MM/yy HH:mm")
                        : "Loading bidding information…"}
                    </p>
                  ) : null}
                </TabsContent>
                <TabsContent value="history" className="space-y-4">
                  {history.loading ? (
                    <LoadingSkeleton label="Loading history…" />
                  ) : bids?.items.length ? (
                    <Table>
                      <TableBody>
                        {bids.items.map((b) => (
                          <TableRow key={b.id}>
                            <TableCell className="max-w-36 break-words">
                              {b.bidderAlias === position.data?.bidderAlias
                                ? "You"
                                : b.bidderLabel || "Bidder"}
                            </TableCell>
                            <TableCell className="text-right">
                              {dollars(b.amount, bids.currency)}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {format(new Date(b.createdAt), "dd/MM/yy HH:mm")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    !history.error && (
                      <p className="text-sm text-muted-foreground">
                        No bids yet.
                      </p>
                    )
                  )}
                  {bids && bids.total > 20 && (
                    <LotPagination
                      page={page}
                      totalPages={Math.ceil(bids.total / 20)}
                      disabled={history.loading}
                      onPageChange={setPage}
                    />
                  )}
                </TabsContent>
                <TabsContent value="details">
                  <dl className="space-y-5 text-sm">
                    {[
                      ["Artwork", item?.name],
                      ["Artist", item?.artistDisplay],
                      ["Year", item?.sourceSnapshot?.dateDisplay],
                      ["Medium", item?.sourceSnapshot?.mediumDisplay],
                      [
                        "Source",
                        item?.sourceSnapshot?.provider === "mock"
                          ? "Development catalog"
                          : "Cleveland / Open access",
                      ],
                      [
                        "Starts",
                        format(new Date(lot.startTime), "dd/MM/yy HH:mm"),
                      ],
                      [
                        "Ends",
                        format(
                          new Date(bids?.endTime ?? lot.endTime),
                          "dd/MM/yy HH:mm",
                        ),
                      ],
                      [
                        "Minimum increment",
                        dollars(lot.bidIncrement, lot.currency),
                      ],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="mb-1 text-[10px] uppercase text-muted-foreground">
                          {label}
                        </dt>
                        <dd className="break-words">{value || "Not listed"}</dd>
                      </div>
                    ))}
                  </dl>
                </TabsContent>
              </Tabs>
              {closed && (
                <div className="flex flex-wrap gap-3 border-t pt-5">
                  <Button asChild variant="outline" className="uppercase">
                    <a href={`/#/audit/${encodeURIComponent(id)}`}>
                      <ShieldCheck aria-hidden="true" />
                      Verify history
                    </a>
                  </Button>
                  {result.data?.canViewReceipt && (
                    <Button asChild variant="outline" className="uppercase">
                      <a href={`/#/receipt/${encodeURIComponent(id)}`}>
                        <ReceiptText aria-hidden="true" />
                        Result / Receipt
                      </a>
                    </Button>
                  )}
                </div>
              )}
              <p
                className="text-[10px] uppercase text-muted-foreground"
                role="status"
              >
                {connected
                  ? "Live updates connected"
                  : "Connecting live updates · Automatic refresh active"}
              </p>
            </CardContent>
          </Card>
        </ArtworkViewer>
      )}
      {!lot && (
        <Button variant="outline" className="uppercase" onClick={refresh}>
          Retry lot
        </Button>
      )}
    </section>
  );
}
