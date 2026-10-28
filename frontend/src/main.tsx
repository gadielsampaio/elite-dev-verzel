import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { SessionProvider } from "./session";

// Separate entry bundles keep the existing API application's global CSS isolated.
const HausApp = lazy(() => import("./haus/HausApp"));
const LegacyApp = lazy(() => import("./LegacyApp"));
const ConnectedApp = lazy(() => import("./haus/connected/ConnectedApp"));
const isHaus = ["/preview", "/preview/"].includes(location.pathname);
const isConnected = location.pathname === "/";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider restoreSession={!isHaus}>
      <Suspense fallback={null}>
        {isConnected ? (
          <ConnectedApp />
        ) : isHaus ? (
          <HausApp />
        ) : (
          <BrowserRouter>
            <LegacyApp />
          </BrowserRouter>
        )}
      </Suspense>
    </SessionProvider>
  </StrictMode>,
);
