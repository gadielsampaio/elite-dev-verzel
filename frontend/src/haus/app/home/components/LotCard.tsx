import { useTranslation } from "@/hooks/useTranslation";
import { AppLink } from "@/haus/app/routing/AppLink";
import { ArrowUpRight } from "lucide-react";
import type { Lot } from "../../../../types/lot";
import { LiveDot } from "../../components/LiveDot";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card";
import { Artwork } from "../../../../components/Artwork";
import { dollars } from "../../../../utils/money";
import { usePreferences } from "../../../../hooks/usePreferences";
import { translations } from "../../../translations";

export function LotCard({ lot }: { lot: Lot }) {
  const { t } = useTranslation();
  const { lang } = usePreferences();
  const s = translations[lang];
  const item = lot.items[0];
  const path = `/lot/${lot.id}`;
  return (
    <AppLink
      to={path}
      aria-label={`${t("View")} ${lot.title}`}
      className="group block h-full focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
    >
      <Card className="h-full overflow-hidden border-transparent shadow-none transition-colors motion-reduce:transition-none group-hover:border-border group-focus-visible:border-border">
        <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-muted">
          <Artwork
            lot={lot}
            className="absolute inset-0 h-full w-full object-cover object-top origin-top transition-transform duration-[1500ms] ease-out motion-safe:group-hover:scale-105 motion-safe:group-focus-visible:scale-105 motion-reduce:transition-none"
          />
        </div>
        <div className="p-4 sm:p-6">
          <CardHeader className="space-y-4 p-0 pb-6">
            <div className="flex items-center justify-between border-b pb-4 text-[10px] uppercase text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                {lot.status === "open" && <LiveDot />}
                {lot.status === "open"
                  ? s.live
                  : lot.status === "scheduled"
                    ? s.upcoming
                    : t("Closed")}
              </span>
              {item?.sourceSnapshot?.provider === "mock" && (
                <span>{t("Development catalog")}</span>
              )}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {item?.artistDisplay || "—"} /{" "}
              {item?.sourceSnapshot?.dateDisplay || "—"}
            </p>
            <CardTitle className="font-display text-xl leading-snug font-medium uppercase">
              {lot.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <p className="text-[10px] uppercase text-muted-foreground">
              {t("Starting bid")}
            </p>
          </CardContent>
          <CardFooter className="justify-between border-t px-0 pt-2">
            <span className="text-lg font-medium tracking-tight">
              {dollars(lot.startingBid, lot.currency)}
            </span>
            <span
              aria-hidden="true"
              className="inline-flex size-9 items-center justify-center border"
            >
              <ArrowUpRight className="size-4" />
            </span>
          </CardFooter>
        </div>
      </Card>
    </AppLink>
  );
}
