import type { ReactNode } from "react";
import { SessionContext } from "./SessionContext";
import { useSessionController } from "./useSessionController";

export function SessionProvider({
  children,
  restoreSession = true,
}: {
  children: ReactNode;
  restoreSession?: boolean;
}) {
  const session = useSessionController(restoreSession);
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
