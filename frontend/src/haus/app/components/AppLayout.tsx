import type { ReactNode } from "react";
import { Outlet } from "react-router";
import { RouteEffects } from "../routing/RouteEffects";
import { AppShell } from "./AppShell";

export function AppLayout({ children }: { children?: ReactNode }) {
  return (
    <>
      <RouteEffects />
      <AppShell>{children ?? <Outlet />}</AppShell>
    </>
  );
}
