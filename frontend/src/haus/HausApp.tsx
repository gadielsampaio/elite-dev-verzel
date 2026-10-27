import { HausProvider, useHaus } from "./model";
import { SiteHeader, SiteFooter, AccountDialog } from "./Layout";
import { HomePage } from "./HomePage";
import { AuthPage } from "./AuthPage";
import { ActivityPage, AuditPage, WalletPage } from "./UtilityPages";
import { LotRoom } from "./LotRoom";
import { SellerStudio } from "./SellerStudio";
import "./styles/storefront.css";
import "./styles/lot-room.css";
import "./styles/seller-studio.css";
import "./styles/system.css";
import "./styles/auth.css";
import "./styles/theme.css";
import "./styles/react.css";
function Screens() {
  const { page, activeId, lots, accountOpen, role } = useHaus();
  const active = lots.find((l) => l.id === activeId);
  // Keep page state across hash navigation, as in the original loaded partials.
  return (
    <>
      <div className="hs-shell" id="main-app" inert={!!active || accountOpen}>
        <SiteHeader />
        <main id="page-root">
          <div hidden={page !== "home"}>
            <HomePage />
          </div>
          <div hidden={page !== "login"}>
            <AuthPage />
          </div>
          <div hidden={page !== "register"}>
            <AuthPage register />
          </div>
          <div hidden={page !== "wallet"}>
            <WalletPage key={role} />
          </div>
          <div hidden={page !== "activity"}>
            <ActivityPage />
          </div>
          <div hidden={page !== "audit"}>
            <AuditPage />
          </div>
          <div hidden={page !== "seller"}>
            <SellerStudio />
          </div>
        </main>
        <SiteFooter />
      </div>
      {active && <LotRoom key={active.id} lot={active} />}{" "}
      {accountOpen && <AccountDialog />}
    </>
  );
}
export default function HausApp() {
  return (
    <HausProvider>
      <Screens />
    </HausProvider>
  );
}
