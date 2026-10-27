import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, type User } from "./api";

type Session = { token: string; user: User };
const Context = createContext<{
  session: Session | null;
  notice: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
} | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const expire = () => {
      setSession(null);
      setNotice("Your session expired. Please sign in again.");
    };
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, []);
  async function login(email: string, password: string) {
    const { accessToken } = await api<{ accessToken: string }>(
      "/auth/login",
      undefined,
      { method: "POST", body: JSON.stringify({ email, password }) },
    );
    // Claims locate the profile only; the API verifies the token and permissions.
    const encoded = accessToken
      .split(".")[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const { sub } = JSON.parse(atob(encoded));
    const user = await api<User>(
      `/users/${encodeURIComponent(sub)}`,
      accessToken,
    );
    setSession({ token: accessToken, user });
    setNotice("");
  }
  return (
    <Context.Provider
      value={{
        session,
        notice,
        login,
        logout: () => {
          setSession(null);
          setNotice("");
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const context = useContext(Context);
  if (!context) throw new Error("Session provider missing");
  return context;
}
