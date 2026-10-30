import { useTranslation } from "@/hooks/useTranslation";
import { useClock } from "../../../../hooks/useClock";
import { formatCountdown } from "../../../../utils/time";
import { AppLink } from "@/haus/app/routing/AppLink";
import { pageTitle } from "../../typography";
import { Alert, AlertDescription } from "../../../../components/ui/alert";
import { LiveDot } from "../../components/LiveDot";
import { useRef } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import type { Lot } from "../../../../types/lot";
import { Button } from "../../../../components/ui/button";
import { Artwork } from "../../../../components/Artwork";
import { useApiQuery } from "../../../../hooks/useApiQuery";
import { dollars } from "../../../../utils/money";
import type { BidSummary } from "../../../../types/bid";
import { usePreferences } from "../../../../hooks/usePreferences";
import { translations } from "../../../translations";

export function FeaturedLot({ lot }: { lot: Lot | null }) {
  const { t } = useTranslation();
  const { lang } = usePreferences();
  const now = useClock();
  const s = translations[lang];
  const bids = useApiQuery<BidSummary>(
    lot ? `/lots/${lot.id}/bids?page=1&limit=1` : null,
  );
  const received = useRef({ data: bids.data, at: now });
  if (received.current.data !== bids.data)
    received.current = { data: bids.data, at: now };
  const serverNow = bids.data
    ? Date.parse(bids.data.serverTime) + now - received.current.at
    : now;
  const item = lot?.items[0];
  return (
    <section className="mx-auto grid max-w-screen-2xl border-b md:grid-cols-2">
      <div className="order-2 flex flex-col gap-10 px-6 py-10 md:order-1 md:px-12 md:py-16">
        <p className="flex items-center gap-3 text-xs font-medium uppercase tracking-wider">
          {lot && <LiveDot />}
          {lot ? s.live : t("No live auctions")}
        </p>
        <div className="space-y-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {s.collection}
          </p>
          <h1 className={pageTitle}>{lot?.title || t("Coming soon")}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {lot
              ? `${item?.artistDisplay || t("Artist not listed")} / ${item?.sourceSnapshot?.dateDisplay || "—"}`
              : t("New lots will be announced shortly.")}
          </p>
        </div>
        <div className="mt-auto space-y-6">
          <dl className="grid grid-cols-2 gap-4 border-t pt-6">
            <div>
              <dt className="text-[10px] uppercase text-muted-foreground">
                {s.bid}
              </dt>
              <dd className="mt-2 text-lg font-medium tracking-tight">
                {bids.data
                  ? dollars(
                      bids.data.currentBid ?? bids.data.startingBid,
                      bids.data.currency,
                    )
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-muted-foreground">
                {s.time}
              </dt>
              <dd className="mt-2 text-lg font-medium tracking-tight tabular-nums">
                {bids.data
                  ? formatCountdown(Date.parse(bids.data.endTime), serverNow)
                  : "—"}
              </dd>
            </div>
          </dl>
          {lot ? (
            <Button
              asChild
              className="h-14 w-full justify-between px-6 text-xs tracking-wider"
            >
              <AppLink to={`/lot/${lot.id}`}>
                {s.view}
                <ArrowUpRight />
              </AppLink>
            </Button>
          ) : (
            <Button disabled className="h-14 w-full">
              {s.view}
            </Button>
          )}
          {bids.error && (
            <Alert variant="destructive">
              <AlertDescription>
                {t("Current bid unavailable.")}{" "}
                <Button variant="link" size="sm" onClick={bids.refresh}>
                  {t("Retry")}
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>
        <Button
          type="button"
          variant="link"
          className="justify-start gap-5 self-start px-0 text-xs uppercase tracking-wider"
          onClick={() =>
            document.getElementById("catalog")?.scrollIntoView({
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "auto"
                : "smooth",
              block: "start",
            })
          }
        >
          {s.explore}
          <ArrowDown />
        </Button>
      </div>
      <div className="relative order-1 min-h-80 overflow-hidden bg-muted md:order-2 md:min-h-full">
        {lot && (
          <AppLink
            to={`/lot/${lot.id}`}
            aria-label={t("View featured lot")}
            className="group absolute inset-0 flex items-center justify-center focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-4"
          >
            <Artwork
              priority
              key={lot.id}
              lot={lot}
              className="h-auto max-h-full w-full object-contain transition-transform duration-2000 ease-out motion-safe:group-hover:scale-90 motion-safe:group-focus-visible:scale-90 motion-reduce:transition-none"
            />
          </AppLink>
        )}
        <span className="pointer-events-none absolute right-6 bottom-5 bg-background/90 px-2 py-1 text-[10px] uppercase text-muted-foreground">
          {item?.sourceSnapshot?.provider || "HAUS SAMPAIO"}{" "}
          {t("/ COLLECTION")}{" "}
        </span>
      </div>
    </section>
  );
}
