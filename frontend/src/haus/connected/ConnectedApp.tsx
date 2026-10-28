import { AccountResults } from "./AccountResults";
import { Receipt } from "./Receipt";
import { Seller } from "./Seller";
import { useEffect, useState } from "react";
import { api } from "../../api";
import { useSession } from "../../session";
import { HausProvider, useHaus } from "../model";
import { SiteHeader, SiteFooter } from "../Layout";
import { AuthPage, type Credentials } from "../AuthPage";
import { BackButton } from "../shared";
import { Storefront } from "./Storefront";
import { PublishedRoom } from "./PublishedRoom";
import { Wallet } from "./Wallet";
import "../styles/storefront.css";
import "../styles/lot-room.css";
import "../styles/seller-studio.css";
import "../styles/system.css";
import "../styles/auth.css";
import "../styles/theme.css";
import "../styles/react.css";
function ConnectedScreens() {
  const { page, go } = useHaus(),
    { session, login, notice } = useSession();
  const [receiptId, setReceiptId] = useState(
    () => location.hash.match(/^#\/receipt\/([^/]+)$/)?.[1] ?? null,
  );
  useEffect(() => {
    const update = () =>
      setReceiptId(location.hash.match(/^#\/receipt\/([^/]+)$/)?.[1] ?? null);
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const [active, setActive] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState("");
  useEffect(() => {
    if (["wallet", "seller", "activity"].includes(page) && !session)
      go("login");
  }, [page, session, go]);
  async function authenticate(credentials: Credentials) {
    setAuthNotice("");
    if (page === "register") {
      await api("/auth/register", undefined, {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      // Registration is not idempotent. Do not re-submit it if the later login fails.
      try {
        await login(credentials.email, credentials.password);
      } catch {
        setAuthNotice("Account created. Please log in to continue.");
        go("login");
        return;
      }
    } else await login(credentials.email, credentials.password);
    go("wallet");
  }
  return (
    <>
      <div className="hs-shell" id="main-app" inert={!!active}>
        <SiteHeader connected />
        <main id="page-root">
          {receiptId ? (
            <Receipt key={receiptId} lotId={receiptId} />
          ) : page === "home" ? (
            <Storefront open={setActive} />
          ) : page === "login" || page === "register" ? (
            <AuthPage
              key={page}
              register={page === "register"}
              onAuthenticate={authenticate}
              notice={notice || authNotice}
            />
          ) : page === "seller" ? (
            <Seller key={session?.user.id ?? "guest"} open={setActive} />
          ) : page === "wallet" ? (
            <Wallet />
          ) : page === "activity" ? (
            <div
              className="hs-tools-preview hs-utility-page hs-seller-page"
              style={{ display: "block" }}
            >
              <AccountResults key={session?.user.id} open={setActive} />
            </div>
          ) : (
            <section
              className="hs-tools-preview hs-utility-page"
              style={{ display: "block" }}
            >
              <BackButton />
              <div className="hs-page-heading">
                <h1 className="hs-page-title">
                  {page === "audit" ? "PUBLIC AUDIT" : "MY BIDS"}
                </h1>
                <p className="hs-page-lead">
                  {"This feature is not available in this release."}
                </p>
              </div>
            </section>
          )}
        </main>
        <SiteFooter connected />
      </div>
      {active && (
        <PublishedRoom key={active} id={active} close={() => setActive(null)} />
      )}
    </>
  );
}
export default function ConnectedApp() {
  return (
    <HausProvider preview={false}>
      <ConnectedScreens />
    </HausProvider>
  );
}
