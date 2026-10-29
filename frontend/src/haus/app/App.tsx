import { NotFoundPage } from "./NotFoundPage";
import { useEffect } from "react";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { AuctionRoom } from "./room/AuctionRoom";
import { ReceiptPage } from "./ReceiptPage";
import { PublicAuditPage } from "./PublicAuditPage";
import { MyBidsPage } from "./MyBidsPage";
import { Toaster } from "../../components/ui/sonner";
import { WalletPage } from "./WalletPage";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { SellerStudio } from "./seller/SellerStudio";
import { useSession } from "../../session";
import { AuthPage } from "./AuthPage";
import { Button } from "../../components/ui/button";
import type { Lot } from "../../api";
import { HausProvider, useHaus } from "../model";
import { useApiQuery, type PageResult } from "../data/queries";
import { Header, Footer } from "./Header";
import { FeaturedLot } from "./FeaturedLot";
import { Catalog } from "./Catalog";
import "./theme.css";

function Home() {
  const { lang, page: routePage, theme } = useHaus();
  const page = location.pathname === "/" ? routePage : "notfound";
  const { session, notice } = useSession();
  useEffect(() => {
    if (!session && notice) {
      const lot = location.hash.match(/^#\/lot\/([0-9a-f-]{36})$/i)?.[1];
      location.hash = `/login${lot ? `?lot=${lot}` : ""}`;
    }
  }, [session, notice]);
  const live = useApiQuery<PageResult<Lot>>(
    [
      "login",
      "register",
      "seller",
      "wallet",
      "activity",
      "audit",
      "receipt",
      "room",
      "notfound",
    ].includes(page)
      ? null
      : "/lots?status=open&page=1&limit=1",
  );
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main key={page} className="hs-page-enter">
        {page === "notfound" ? (
          <NotFoundPage />
        ) : page === "login" || page === "register" ? (
          <AuthPage key={page} register={page === "register"} />
        ) : page === "seller" ? (
          <SellerStudio key={session?.user.id ?? "guest"} />
        ) : page === "wallet" ? (
          <WalletPage />
        ) : page === "activity" ? (
          <MyBidsPage key={session?.user.id ?? "guest"} />
        ) : page === "audit" ? (
          <PublicAuditPage />
        ) : page === "room" ? (
          <AuctionRoom />
        ) : page === "receipt" ? (
          <ReceiptPage />
        ) : (
          <>
            {live.loading ? (
              <LoadingSkeleton
                label={
                  lang === "PT" ? "Carregando leilões…" : "Loading auctions…"
                }
                layout="hero"
              />
            ) : live.error ? (
              <div className="mx-auto max-w-screen-2xl px-6 py-12 md:px-12">
                <Alert variant="destructive" className="space-y-4">
                  <AlertDescription>{live.error}</AlertDescription>
                  <Button variant="outline" onClick={live.refresh}>
                    {lang === "PT" ? "Tentar novamente" : "Retry featured lot"}
                  </Button>
                </Alert>
              </div>
            ) : (
              <FeaturedLot
                key={live.data?.items[0]?.id || "empty"}
                lot={live.data?.items[0] || null}
              />
            )}
            <Catalog liveTotal={live.data?.total} />
          </>
        )}
      </main>
      <Footer />
      <Toaster
        theme={theme === "dark" ? "dark" : "light"}
        position="bottom-right"
        closeButton
      />
    </div>
  );
}
export default function AuctionApp() {
  return (
    <HausProvider>
      <Home />
    </HausProvider>
  );
}
