import type { ReactNode } from "react";
import { SessionSkeleton } from "../../../../components/SessionSkeleton";
import { useSession } from "../../../../hooks/useSession";
import { AppShell } from "../../components/AppShell";
import { SessionRecovery } from "./SessionRecovery";

export function SessionBoundary({ children }: { children: ReactNode }) {
  const { restoring, restoreError, retryRestore, logout } = useSession();

  if (restoring) return <SessionSkeleton />;

  if (restoreError) {
    return (
      <AppShell>
        <SessionRecovery error={restoreError} onRetry={retryRestore} onSignOut={logout} />
      </AppShell>
    );
  }

  return children;
}
