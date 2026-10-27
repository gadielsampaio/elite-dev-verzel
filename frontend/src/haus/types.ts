export type Language = "EN" | "PT";
export type PageName =
  "home" | "activity" | "wallet" | "seller" | "audit" | "login" | "register";
export type Role = "Collector A" | "Collector B" | "Auctioneer" | "Guest";
export type Lot = {
  id: string;
  title: string;
  artist: string;
  year: string;
  image: string;
  status: "live" | "scheduled" | "closed" | "cancelled";
  start: number;
  increment: number;
  endsAt: number;
  startsAt?: number;
  bids: { person: Role; value: number }[];
  description: string;
  provider?: string;
  seller?: string;
  estimatedValue?: number;
  sourceId?: number;
  medium?: string;
  sourceFetchedAt?: string;
  sourceSnapshot?: Omit<CatalogArtwork, "image" | "source"> & {
    imageUrl: string;
  };
};
export type CatalogArtwork = {
  id: number;
  title: string;
  artist: string;
  year: string;
  image: string;
  medium: string;
  artworkType: string;
  provider: string;
  source: "sample" | "api";
  isPublicDomain: boolean;
};
