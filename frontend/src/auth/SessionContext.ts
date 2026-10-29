import { createContext } from "react";
import type { SessionContextValue } from "../types/session";

export const SessionContext = createContext<SessionContextValue | null>(null);
