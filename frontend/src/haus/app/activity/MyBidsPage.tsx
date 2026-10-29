import { useTranslation } from "@/hooks/useTranslation";
import { ParticipationRow } from "./components/ParticipationRow";
import { AppLink } from "@/haus/app/routing/AppLink";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useSession } from "../../../hooks/useSession";
import { useApiQuery } from "../../../hooks/useApiQuery";
import type { PageResult } from "../../../types/pagination";
import type { AccountResult } from "../../../types/results";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../../../components/ui/tabs";
import { navigationItemStyles } from "../../../components/ui/navigation-item";
import { LotPagination } from "../components/LotPagination";
import { pageTitle, sectionTitle } from "../typography";

export function MyBidsPage() {
  const { t } = useTranslation();
  const { session } = useSession();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const allowed = session?.user.role === "bidder";
  const query = useApiQuery<PageResult<AccountResult>>(
    allowed ? `/me/participations?page=${page}&limit=9&filter=${filter}` : null,
    session?.token,
  );
  return (
    <section
      className="mx-auto max-w-screen-2xl space-y-10 px-6 py-16 md:px-12 md:py-24"
      aria-labelledby="my-bids-title"
    >
      <header className="space-y-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {t("Private area / Bidder")}{" "}
        </p>
        <h1 id="my-bids-title" className={pageTitle}>
          {t("My bids")}{" "}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {t(
            "Follow your auction participation, highest bids and confirmed wins.",
          )}{" "}
        </p>
      </header>
      {!allowed ? (
        <div className="space-y-6">
          <Alert>
            <AlertDescription>
              {session
                ? t("A bidder account is required to view My bids.")
                : t("Sign in as a bidder to view your bids.")}
            </AlertDescription>
          </Alert>
          {!session && (
            <Button asChild className="uppercase">
              <AppLink to="/login">{t("Log in")}</AppLink>
            </Button>
          )}
        </div>
      ) : (
        <Tabs
          value={filter}
          onValueChange={(value) => {
            setPage(1);
            setFilter(value);
          }}
          className="flex flex-col gap-8"
        >
          <TabsList
            aria-label={t("Participation filter")}
            className="h-auto w-full justify-start gap-6 rounded-none border-b bg-transparent p-0"
          >
            <TabsTrigger value="all" className={navigationItemStyles}>
              {t("All participation")}{" "}
            </TabsTrigger>
            <TabsTrigger value="wins" className={navigationItemStyles}>
              {t("My wins")}{" "}
            </TabsTrigger>
          </TabsList>
          <TabsContent value={filter} className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <h2 className={sectionTitle}>
                {filter === "wins" ? t("Confirmed wins") : t("Your auctions")}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("Refresh bids")}
                title={t("Refresh bids")}
                className="shrink-0"
                disabled={query.loading}
                onClick={query.refresh}
              >
                <RefreshCw aria-hidden="true" />
              </Button>
            </div>
            {query.loading && (
              <LoadingSkeleton label={t("Loading your bids…")} layout="rows" />
            )}
            {query.error && (
              <Alert variant="destructive">
                <AlertDescription>{t(query.error)}</AlertDescription>
              </Alert>
            )}
            {query.data?.items.length === 0 && (
              <div className="border px-6 py-12 text-center text-sm text-muted-foreground">
                {filter === "wins"
                  ? t("No confirmed wins yet.")
                  : t("You haven’t placed any bids yet.")}
              </div>
            )}
            <div className="[&>article:not(:last-child)]:border-b-border">
              {query.data?.items.map((result) => (
                <ParticipationRow key={result.lotId} result={result} />
              ))}
            </div>
            {!!query.data?.total && (
              <LotPagination
                page={page}
                totalPages={Math.ceil(query.data.total / 9)}
                disabled={query.loading}
                onPageChange={setPage}
              />
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t(
                "Only completed settlements count as confirmed wins. Receipts use simulated funds.",
              )}{" "}
            </p>
          </TabsContent>
        </Tabs>
      )}
    </section>
  );
}
