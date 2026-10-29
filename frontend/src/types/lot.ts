export type Lot = {
  id: string;
  title: string;
  status: "scheduled" | "open" | "closed";
  currency: string;
  startingBid: string;
  bidIncrement: string;
  startTime: string;
  endTime: string;
  items: {
    id: string;
    name: string;
    imageUrl: string | null;
    printImageUrl?: string | null;
    artistDisplay: string | null;
    sourceSnapshot: {
      provider?: string;
      mediumDisplay?: string | null;
      dateDisplay?: string | null;
    } | null;
  }[];
};
