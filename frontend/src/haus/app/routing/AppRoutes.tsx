import { Route, Routes } from "react-router";
import { useSession } from "../../../hooks/useSession";
import { AppLayout } from "../components/AppLayout";
import { HomePage } from "../home/HomePage";
import { AuthPage } from "../auth/AuthPage";
import { WalletPage } from "../wallet/WalletPage";
import { MyBidsPage } from "../activity/MyBidsPage";
import { PublicAuditPage } from "../audit/PublicAuditPage";
import { ReceiptPage } from "../receipt/ReceiptPage";
import { NotFoundPage } from "../not-found/NotFoundPage";
import { AuctionRoom } from "../room/AuctionRoom";
import { SellerStudio } from "../seller/SellerStudio";

export function AppRoutes() {
  const { session } = useSession();
  const accountKey = session?.user.id ?? "guest";

  // Hash routes belong to the root document. Unknown document paths stay 404.
  if (window.location.pathname !== "/") {
    return (
      <AppLayout>
        <NotFoundPage />
      </AppLayout>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="home" element={<HomePage />} />
        <Route path="login" element={<AuthPage key="login" />} />
        <Route path="register" element={<AuthPage key="register" register />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="activity" element={<MyBidsPage key={accountKey} />} />
        <Route path="seller" element={<SellerStudio key={accountKey} />} />
        <Route path="lot/:lotId" element={<AuctionRoom />} />
        <Route path="receipt/:lotId?" element={<ReceiptPage />} />
        <Route path="audit/:lotId?" element={<PublicAuditPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
