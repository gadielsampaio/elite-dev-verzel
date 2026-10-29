import { useTranslation } from "@/hooks/useTranslation";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { useApiQuery } from "../../../hooks/useApiQuery";
import type { Lot } from "../../../types/lot";
import type { PageResult } from "../../../types/pagination";
import { usePreferences } from "../../../hooks/usePreferences";
import { translations } from "../../translations";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { FeaturedLot } from "./components/FeaturedLot";
import { Catalog } from "./components/Catalog";

type FeaturedQuery = ReturnType<typeof useApiQuery<PageResult<Lot>>>;

function FeaturedAuction({ query }: { query: FeaturedQuery }) {
  const { t } = useTranslation();
  const { lang } = usePreferences();
  const text = translations[lang];

  if (query.loading) {
    return <LoadingSkeleton label={text.loadingAuctions} layout="hero" />;
  }

  if (query.error) {
    return (
      <div className="mx-auto max-w-screen-2xl px-6 py-12 md:px-12">
        <Alert variant="destructive" className="space-y-4">
          <AlertDescription>{t(query.error)}</AlertDescription>
          <Button variant="outline" onClick={query.refresh}>
            {text.retryFeaturedLot}
          </Button>
        </Alert>
      </div>
    );
  }

  const lot = query.data?.items[0] ?? null;
  return <FeaturedLot key={lot?.id ?? "empty"} lot={lot} />;
}

export function HomePage() {
  const live = useApiQuery<PageResult<Lot>>("/lots?status=open&page=1&limit=1");

  return (
    <>
      <FeaturedAuction query={live} />
      <Catalog liveTotal={live.data?.total} />
    </>
  );
}
