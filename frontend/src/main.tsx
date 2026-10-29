import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { SessionProvider } from "./session";
import { SessionSkeleton } from "./components/SessionSkeleton";
import "./haus/app/theme.css";

const App = lazy(() => import("./haus/app/App"));

// Preserve previously shared links without loading a second application.
const path = location.pathname.replace(/\/$/, "");
let hash: string | undefined;
if (path === "/shadcn" || path === "/lots") hash = location.hash || "#/home";
else if (/^\/lots\/[^/]+$/.test(path)) hash = `#/lot/${path.split("/")[2]}`;
else if (/^\/(login|register|wallet|seller|activity|audit)$/.test(path))
  hash = `#${path}`;
if (hash) history.replaceState(history.state, "", `/${location.search}${hash}`);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider>
      <Suspense fallback={<SessionSkeleton />}>
        <App />
      </Suspense>
    </SessionProvider>
  </StrictMode>,
);
