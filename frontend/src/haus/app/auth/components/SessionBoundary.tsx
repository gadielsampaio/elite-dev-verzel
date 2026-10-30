import type { ReactNode } from "react";
import { matchPath, useLocation } from "react-router";
import { useSession } from "../../../../hooks/useSession";
import { LoadingSkeleton } from "../../components/LoadingSkeleton";
import { SessionRecovery } from "./SessionRecovery";

export function SessionBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { restoring, restoreError, retryRestore, logout } = useSession();
  // Public content must not wait for a sleeping API to restore authentication.
  // Keep forms and account-specific reads behind restoration to avoid races.
  const needsSession = window.location.pathname === "/" &&
    ["/login", "/register", "/wallet", "/activity", "/seller", "/receipt/*"]
      .some((path) => matchPath(path, pathname));

  if (!needsSession) return children;
  if (restoring) return <LoadingSkeleton label="Verifying your session" layout="hero" />;
  if (restoreError) {
    return <SessionRecovery error={restoreError} onRetry={retryRestore} onSignOut={logout} />;
  }
  return children;
}
