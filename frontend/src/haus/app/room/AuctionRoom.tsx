import { useTranslation } from "@/hooks/useTranslation";
import { useAuctionRoom } from "@/hooks/useAuctionRoom";
import { auctionLabel, timeRemaining, settlementNotice } from "./presentation";
import { QueryErrors } from "../components/QueryErrors";
import { RoomBidding } from "./components/RoomBidding";
import { RoomHistory } from "./components/RoomHistory";
import { RoomDetails } from "./components/RoomDetails";
import { AppLink } from "@/haus/app/routing/AppLink";
import { useParams } from "react-router";
import { RoomSkeleton } from "./components/RoomSkeleton";
import { RefreshCw, ShieldCheck, ReceiptText } from "lucide-react";
import { dollars } from "../../../utils/money";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { navigationItemStyles } from "../../../components/ui/navigation-item";
import { pageTitle } from "../typography";
import { LiveDot } from "../components/LiveDot";
import { ArtworkViewer } from "./components/ArtworkViewer";

export function AuctionRoom() {
  const { lotId = "" } = useParams();
  return <Room key={lotId} id={lotId} />;
}

function Room({ id }: { id: string }) {
  const { t } = useTranslation();
  const model = useAuctionRoom(id);
  const {
    detail,
    history,
    position,
    result,
    lot,
    bids,
    item,
    closed,
    elapsed,
    open,
    refresh,
    connected,
    image,
  } = model;
  const errors = [detail.error, history.error, position.error, result.error];
  const settlement = settlementNotice(model);
  if (!lot && detail.loading) return <RoomSkeleton />;
  if (!lot) {
    return (
      <section className="flex min-h-[65svh] items-center justify-center px-6 py-20 text-center">
        <div className="w-full max-w-lg space-y-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("The auction room")}
          </p>
          <h1 className={pageTitle}>
            {detail.error ? t("Lot unavailable") : t("Loading lot…")}
          </h1>
          {detail.error && (
            <p className="text-sm text-muted-foreground">{t(detail.error)}</p>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild className="h-12 uppercase">
              <AppLink to="/home">{t("Back to auctions")}</AppLink>
            </Button>
            <Button variant="outline" className="h-12 uppercase" onClick={refresh}>
              {t("Retry lot")}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <ArtworkViewer
        image={image}
        preview={item?.imageUrl}
        title={lot.title}
        artist={item?.artistDisplay || t("Artist not listed")}
        year={item?.sourceSnapshot?.dateDisplay || "—"}
        provider={item?.sourceSnapshot?.provider}
      >
        <Card className="min-w-0 rounded-none py-0 shadow-none">
          <CardContent className="space-y-6 p-5 sm:p-6">
            <QueryErrors errors={errors} />
            <Tabs defaultValue="bid" className="gap-6">
              <TabsList
                aria-label={t("Auction room sections")}
                className="h-auto w-full justify-start gap-5 overflow-x-auto rounded-none border-b bg-transparent p-0"
              >
                <TabsTrigger value="bid" className={navigationItemStyles}>
                  {t("Bid")}{" "}
                </TabsTrigger>
                <TabsTrigger value="history" className={navigationItemStyles}>
                  {t("History")}{" "}
                </TabsTrigger>
                <TabsTrigger value="details" className={navigationItemStyles}>
                  {t("Artwork details")}{" "}
                </TabsTrigger>
              </TabsList>
              <div className="flex items-center justify-between gap-4">
                <p className="flex items-center gap-2 text-xs uppercase tracking-wider">
                  {open && <LiveDot />}
                  {t(auctionLabel(model))}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("Refresh lot")}
                  onClick={refresh}
                >
                  <RefreshCw aria-hidden="true" />
                </Button>
              </div>
              <dl className="grid grid-cols-2 gap-4 border-y py-5">
                <div className="min-w-0 space-y-2">
                  <dt className="text-[10px] uppercase text-muted-foreground">
                    {closed || elapsed ? t("Last bid") : t("Current bid")}
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
                    {t("Time remaining")}{" "}
                  </dt>
                  <dd className="font-display text-xl tracking-tight">
                    {t(timeRemaining(model))}
                  </dd>
                </div>
              </dl>
              {(closed || elapsed) && (
                <Alert role="status" className={settlement.className}>
                  <AlertDescription>{t(settlement.text)}</AlertDescription>
                </Alert>
              )}
              <RoomBidding model={model} />
              <RoomHistory model={model} />
              <RoomDetails model={model} />
            </Tabs>
            {closed && (
              <div className="grid gap-3 border-t pt-5">
                <Button asChild variant="outline" className="w-full uppercase">
                  <AppLink to={`/audit/${encodeURIComponent(id)}`}>
                    <ShieldCheck aria-hidden="true" />
                    {t("Verify history")}{" "}
                  </AppLink>
                </Button>
                {result.data?.canViewReceipt && (
                  <Button asChild variant="outline" className="w-full uppercase">
                    <AppLink to={`/receipt/${encodeURIComponent(id)}`}>
                      <ReceiptText aria-hidden="true" />
                      {t("Result / Receipt")}{" "}
                    </AppLink>
                  </Button>
                )}
              </div>
            )}
            <p
              className="text-[10px] uppercase text-muted-foreground"
              role="status"
            >
              {connected
                ? t("Live updates connected")
                : t("Connecting live updates · Automatic refresh active")}
            </p>
          </CardContent>
        </Card>
      </ArtworkViewer>
    </section>
  );
}
