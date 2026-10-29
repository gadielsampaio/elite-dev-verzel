import type { User } from "./user";

export type Session = { token: string; user: User };

export type SessionContextValue = {
  session: Session | null;
  notice: string;
  restoring: boolean;
  restoreError: string;
  warning: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  retryRestore: () => void;
};
