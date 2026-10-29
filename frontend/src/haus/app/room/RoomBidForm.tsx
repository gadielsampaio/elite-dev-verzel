import { toast } from "sonner";
import { Button } from "../../../components/ui/button";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import { MoneyInput } from "../../../MoneyInput";
import { useBid } from "../../data/useBid";
import { dollars } from "../../data/queries";
export function RoomBidForm(props: {
  lotId: string;
  userId: string;
  token: string;
  minimum: string | null;
  currency: string;
  eligible: boolean;
  refresh: () => void;
}) {
  const bid = useBid({
    ...props,
    refresh: (accepted) => {
      props.refresh();
      if (accepted) toast.success("Bid accepted");
    },
    onInsufficientBalance: () => {
      location.hash = `/wallet?lot=${encodeURIComponent(props.lotId)}`;
    },
  });
  return (
    <form onSubmit={bid.submit} className="space-y-4">
      {props.minimum && (
        <p className="text-xs text-muted-foreground">
          Minimum next bid: {dollars(props.minimum, props.currency)}
        </p>
      )}
      <label htmlFor="room-bid-amount" className="block text-xs uppercase">
        Bid amount ({props.currency})
      </label>
      <MoneyInput
        id="room-bid-amount"
        className="h-12 w-full min-w-0 rounded-none border bg-transparent px-3 text-right text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
        value={bid.amount}
        onValueChange={bid.setAmount}
        disabled={bid.busy || !!bid.pending || !props.eligible}
        required
      />
      {bid.pending && (
        <Alert>
          <AlertDescription>
            Awaiting confirmation. Retry the same bid safely; its amount cannot
            be changed.
          </AlertDescription>
        </Alert>
      )}
      <Button
        type="submit"
        className="h-12 w-full uppercase"
        disabled={bid.busy || (!props.eligible && !bid.pending)}
      >
        {bid.busy ? "Submitting…" : bid.pending ? "Retry bid" : "Place bid"}
      </Button>
      {bid.error && (
        <Alert variant="destructive">
          <AlertDescription>{bid.error}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
