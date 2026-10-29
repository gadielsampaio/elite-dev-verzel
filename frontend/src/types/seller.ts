import type { Lot } from "./lot";

export type OwnedLot = Omit<Lot, "status"> & {
  status: Lot["status"] | "cancelled" | "draft";
  bidCount: number;
  canCancel: boolean;
};

export type SellerSummary = {
  lots: number;
  live: number;
  sold: number;
  totalReceived: string;
  currency: string;
};
