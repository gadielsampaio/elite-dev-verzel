import type { ReactNode } from "react";
import { Outlet } from "react-router";
import { RouteEffects } from "../routing/RouteEffects";
import { SessionBoundary } from "../auth/components/SessionBoundary";
import { AppShell } from "./AppShell";

export function AppLayout({ children }: { children?: ReactNode }) {
  return (
    <>
      <RouteEffects />
      <AppShell>
        <SessionBoundary>{children ?? <Outlet />}</SessionBoundary>
      </AppShell>
    </>
  );
}
