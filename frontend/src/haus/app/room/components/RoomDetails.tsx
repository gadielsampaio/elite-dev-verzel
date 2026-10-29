import { useTranslation } from "@/hooks/useTranslation";
import { format } from "date-fns";
import { dollars } from "@/utils/money";
import { TabsContent } from "@/components/ui/tabs";
import type { AuctionRoomModel } from "@/hooks/useAuctionRoom";

export function RoomDetails({ model }: { model: AuctionRoomModel }) {
  const { t } = useTranslation();
  const { lot, item, bids } = model;
  if (!lot) return null;

  return (
    <TabsContent value="details">
      <dl className="space-y-5 text-sm">
        {[
          [t("Artwork"), item?.name],
          [t("Artist"), item?.artistDisplay],
          [t("Year"), item?.sourceSnapshot?.dateDisplay],
          [t("Medium"), item?.sourceSnapshot?.mediumDisplay],
          [
            t("Source"),
            item?.sourceSnapshot?.provider === "mock"
              ? t("Development catalog")
              : t("Cleveland / Open access"),
          ],
          [t("Starts"), format(new Date(lot.startTime), "dd/MM/yy HH:mm")],
          [
            t("Ends"),
            format(new Date(bids?.endTime ?? lot.endTime), "dd/MM/yy HH:mm"),
          ],
          [t("Minimum increment"), dollars(lot.bidIncrement, lot.currency)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="mb-1 text-[10px] uppercase text-muted-foreground">
              {label}
            </dt>
            <dd className="break-words">{value || t("Not listed")}</dd>
          </div>
        ))}
      </dl>
    </TabsContent>
  );
}
