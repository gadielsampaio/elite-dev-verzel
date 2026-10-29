import type { AuctionRoomModel } from "@/hooks/useAuctionRoom";
import { formatCountdown } from "@/utils/time";

export function auctionLabel({ closed, elapsed, bids, open }: AuctionRoomModel) {
  if (closed) return "Auction closed";
  if (elapsed) return "Bidding ended";
  if (bids?.status === "scheduled") return "Upcoming";
  if (open) return "Live now";
  return "Loading auction…";
}

export function timeRemaining({ open, bids, serverNow, closed, elapsed }: AuctionRoomModel) {
  if (open && bids) return formatCountdown(Date.parse(bids.endTime), serverNow);
  if (closed || elapsed) return "Ended";
  if (bids?.status === "scheduled") return "Upcoming";
  return "—";
}

export function settlementNotice({ settled, participated, won, result }: AuctionRoomModel) {
  if (settled && participated) {
    return won
      ? { className: "border-success text-success", text: "You won this auction. Settlement is complete." }
      : { className: "border-destructive text-destructive", text: "You did not win this auction. Settlement is complete." };
  }
  if (settled) return { text: "This auction has settled." };
  if (result.data?.status === "no_winner") {
    return { text: "Closed without a winner. No funds were transferred." };
  }
  return { text: "Bidding has ended. The final result is awaiting confirmation." };
}
