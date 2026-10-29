import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Language, PageName } from "./types";
export function clock(end: number, now: number) {
  const d = Math.max(0, Math.floor((end - now) / 1000));
  const days = Math.floor(d / 86400);
  const time = [
    Math.floor((d % 86400) / 3600),
    Math.floor((d % 3600) / 60),
    d % 60,
  ]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
  return days ? `${days}d ${time}` : time;
}
export function getPage(): PageName {
  const hash = location.hash.split("?")[0];
  if (["", "#", "#/"].includes(hash)) return "home";
  if (/^#\/lot\/[^/]+$/.test(hash)) return "room";
  if (/^#\/receipt(?:\/[^/]+)?$/.test(hash)) return "receipt";
  if (/^#\/audit\/[^/]+$/.test(hash)) return "audit";
  return (
    (hash.match(
      /^#\/(home|activity|wallet|seller|audit|login|register)$/,
    )?.[1] as PageName) || "notfound"
  );
}
function useModel() {
  const [lang, setLang] = useState<Language>("EN");
  const [page, setPage] = useState(getPage);
  const [now, setNow] = useState(Date.now);
  const [theme, setTheme] = useState(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const change = () => {
      setPage(getPage());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    change();
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang.toLowerCase();
  }, [lang]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#181817" : "#f5efe3");
  }, [theme]);
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("haus-sampaio-theme", next);
    } catch {
      /* Private mode */
    }
  }
  function go(next: PageName) {
    setPage(next);
    location.hash = `/${next}`;
    window.scrollTo(0, 0);
  }
  return { lang, setLang, page, go, now, theme, toggleTheme };
}
const Context = createContext<ReturnType<typeof useModel> | null>(null);
export function HausProvider({ children }: { children: ReactNode }) {
  const model = useModel();
  return <Context.Provider value={model}>{children}</Context.Provider>;
}
export function useHaus() {
  const model = useContext(Context);
  if (!model) throw Error("HausProvider missing");
  return model;
}
