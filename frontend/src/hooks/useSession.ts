import { useContext } from "react";
import { SessionContext } from "../auth/SessionContext";

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("Session provider missing");

  return context;
}
