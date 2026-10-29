import { useTranslation } from "@/hooks/useTranslation";
import { AppLink } from "@/haus/app/routing/AppLink";
import { format } from "date-fns";
import { dollars } from "@/utils/money";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TabsContent } from "@/components/ui/tabs";
import { RoomBidForm } from "./RoomBidForm";
import type { AuctionRoomModel } from "@/hooks/useAuctionRoom";

export function RoomBidding({ model }: { model: AuctionRoomModel }) {
  return (
    <TabsContent
      value="bid"
      forceMount
      className="space-y-5 data-[state=inactive]:hidden"
    >
      <BiddingContent model={model} />
    </TabsContent>
  );
}

function bidderLabel({ position, participated }: AuctionRoomModel) {
  if (position.data?.isLeading) return "You are currently leading";
  if (participated) return "You have been outbid";
  return "Place your bid";
}

function BiddingContent({ model }: { model: AuctionRoomModel }) {
  const { t } = useTranslation();
  const {
    id,
    session,
    position,
    history,
    lot,
    bids,
    open,
    closed,
    elapsed,
    refresh,
  } = model;
  if (!lot) return null;
  if (!open) {
    if (closed || elapsed) return null;
    return (
      <p className="text-sm text-muted-foreground">
        {bids?.status === "scheduled"
          ? t("Bidding opens at {date}", {
            date: format(new Date(lot.startTime), "dd/MM/yy HH:mm"),
          })
          : t("Loading bidding information…")}
      </p>
    );
  }

  if (session?.user.role === "bidder") {
    return (
      <>
        <p className="text-xs uppercase text-muted-foreground">
          {t(bidderLabel(model))}
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
    );
  }

  if (session) {
    return (
      <Alert>
        <AlertDescription>
          {t("Only bidder accounts can place bids.")}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <p className="text-xs uppercase text-muted-foreground">
        {t("Sign in to bid")}{" "}
      </p>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          {t("Minimum next bid:")}{" "}
          {dollars(bids!.minimumNextBid ?? bids!.startingBid, lot.currency)}
        </p>
        <label htmlFor="guest-bid" className="block text-xs uppercase">
          {t("Bid amount ({currency})", { currency: lot.currency })}
        </label>
        <Input
          id="guest-bid"
          disabled
          placeholder={t("Log in to place a bid")}
          className="h-12 w-full border bg-transparent px-3 text-right text-sm disabled:opacity-50"
        />
        <Button asChild className="h-12 w-full uppercase">
          <AppLink to={`/login?lot=${encodeURIComponent(id)}`}>
            {t("Login")}{" "}
          </AppLink>
        </Button>
      </div>
    </>
  );
}
