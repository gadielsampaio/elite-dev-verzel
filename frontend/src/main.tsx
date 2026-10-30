import { StrictMode, lazy, Suspense } from "react";
import { HashRouter } from "react-router";
import { restoreLegacyLink } from "./haus/app/routing/legacyLinks";
import { createRoot } from "react-dom/client";
import { SessionProvider } from "./auth/SessionProvider";
import { PreferencesProvider } from "./preferences/PreferencesProvider";
import { SessionSkeleton } from "./components/SessionSkeleton";
import "./haus/app/theme.css";

const App = lazy(() => import("./haus/app/App"));

restoreLegacyLink();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <PreferencesProvider>
        <SessionProvider>
          <Suspense fallback={<SessionSkeleton />}>
            <App />
          </Suspense>
        </SessionProvider>
      </PreferencesProvider>
    </HashRouter>
  </StrictMode>,
);
