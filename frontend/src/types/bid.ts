export type BidSummary = {
  lotId: string;
  status: "open" | "scheduled" | "closed";
  serverTime: string;
  endTime: string;
  currentBid: string | null;
  minimumNextBid: string | null;
  currency: string;
  startingBid: string;
  items: {
    id: string;
    bidderAlias: string;
    bidderLabel?: string;
    amount: string;
    createdAt: string;
    isActive: boolean;
  }[];
  total: number;
  page: number;
  limit: number;
};
