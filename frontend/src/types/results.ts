export type Result = {
  winnerAlias?: string;
  canViewReceipt?: boolean;
  lotId: string;
  title: string;
  currency: string;
  endTime: string;
  status: "settled" | "awaiting_close" | "pending_settlement" | "no_winner";
  items: { name: string; imageUrl: string | null }[];
  receipt: {
    id: string;
    amount: string;
    winnerAlias: string;
    winningBidId: string;
    endedAt: string;
    settledAt: string;
  } | null;
};

export type AccountResult = {
  lotId: string;
  title: string;
  currency: string;
  status: string;
  outcome: string;
  endTime: string;
  settledAt: string | null;
  amount: string | null;
  receiptPath: string | null;
  won?: boolean;
  myBestBid?: string | null;
  items: { name: string; imageUrl: string | null }[];
};
