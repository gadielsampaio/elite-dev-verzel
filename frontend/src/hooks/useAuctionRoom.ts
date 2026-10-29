import { useEffect, useRef, useState } from "react";
import { useClock } from "./useClock";
import { useSession } from "./useSession";
import { useApiQuery } from "./useApiQuery";
import { useLiveRefresh } from "./useLiveRefresh";
import { useRoomImage } from "./useRoomImage";
import type { Lot } from "../types/lot";
import type { Result } from "../types/results";
import type { BidSummary } from "../types/bid";
import type { Position } from "../types/position";

export const BID_HISTORY_PAGE_SIZE = 20;
const MAX_TIMEOUT_MS = 2_147_483_647;
const BOUNDARY_BUFFER_MS = 100;

export function useAuctionRoom(id: string) {
  const { session } = useSession();
  const now = useClock();
  const [page, setPage] = useState(1);
  const detail = useApiQuery<Lot>(
    `/lots/${encodeURIComponent(id)}`,
    undefined,
    true,
  );
  const history = useApiQuery<BidSummary>(
    detail.data
      ? `/lots/${encodeURIComponent(id)}/bids?page=${page}&limit=${BID_HISTORY_PAGE_SIZE}`
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
  const lot = detail.data;
  const bids = history.data;
  const item = lot?.items[0];
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
      MAX_TIMEOUT_MS,
      Math.max(BOUNDARY_BUFFER_MS, Date.parse(boundary) - serverNow + BOUNDARY_BUFFER_MS),
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

  return {
    id,
    session,
    page,
    setPage,
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
    settled,
    participated,
    won,
    serverNow,
  };
}

export type AuctionRoomModel = ReturnType<typeof useAuctionRoom>;
