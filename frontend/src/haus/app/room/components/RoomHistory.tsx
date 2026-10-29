import { useTranslation } from "@/hooks/useTranslation";
import { LoadingSkeleton } from "@/haus/app/components/LoadingSkeleton";
import { format } from "date-fns";
import { dollars } from "@/utils/money";
import { TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { LotPagination } from "@/haus/app/components/LotPagination";
import type { AuctionRoomModel } from "@/hooks/useAuctionRoom";
import { BID_HISTORY_PAGE_SIZE } from "@/hooks/useAuctionRoom";

export function RoomHistory({ model }: { model: AuctionRoomModel }) {
  const { t } = useTranslation();
  const { history, bids, position, page, setPage } = model;

  return (
    <TabsContent value="history" className="space-y-4">
      {history.loading ? (
        <LoadingSkeleton label={t("Loading history…")} />
      ) : bids?.items.length ? (
        <Table>
          <TableBody>
            {bids.items.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="max-w-36 break-words">
                  {b.bidderAlias === position.data?.bidderAlias
                    ? t("You")
                    : b.bidderLabel || t("Bidder")}
                </TableCell>
                <TableCell className="text-right">
                  {dollars(b.amount, bids.currency)}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {format(new Date(b.createdAt), "dd/MM/yy HH:mm")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        !history.error && (
          <p className="text-sm text-muted-foreground">{t("No bids yet.")} </p>
        )
      )}
      {bids && bids.total > BID_HISTORY_PAGE_SIZE && (
        <LotPagination
          page={page}
          totalPages={Math.ceil(bids.total / BID_HISTORY_PAGE_SIZE)}
          disabled={history.loading}
          onPageChange={setPage}
        />
      )}
    </TabsContent>
  );
}
