import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { initialLots } from "./fixtures";
import type { Language, Lot, PageName, Role } from "./types";
export const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
export const current = (lot: Lot) =>
  lot.bids.length ? Math.max(...lot.bids.map((b) => b.value)) : lot.start;
export function status(lot: Lot, now = Date.now()): Lot["status"] {
  if (lot.status === "cancelled") return "cancelled";
  if (lot.status === "closed" || lot.endsAt <= now) return "closed";
  return lot.startsAt
    ? lot.startsAt > now
      ? "scheduled"
      : "live"
    : lot.status;
}
export function clock(end: number, now: number) {
  const d = Math.max(0, Math.floor((end - now) / 1000));
  return [Math.floor(d / 3600), Math.floor((d % 3600) / 60), d % 60]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
}
const storageKey = "haus-sampaio-seller-demo-v1";
function readLots(): Lot[] {
  const lots = structuredClone(initialLots);
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    if (Array.isArray(saved.newLots))
      for (const lot of saved.newLots) {
        if (
          lot &&
          typeof lot.id === "string" &&
          typeof lot.title === "string" &&
          typeof lot.image === "string" &&
          typeof lot.artist === "string" &&
          Number.isFinite(lot.endsAt) &&
          Number.isFinite(lot.start) &&
          Number.isFinite(lot.increment) &&
          Array.isArray(lot.bids) &&
          lot.bids.every(
            (b: { value: unknown; person: unknown }) =>
              Number.isFinite(b?.value) && typeof b?.person === "string",
          ) &&
          !lots.some((l) => l.id === lot.id)
        )
          lots.push(lot);
      }
    if (Array.isArray(saved.cancelled))
      for (const lot of lots)
        if (saved.cancelled.includes(lot.id)) lot.status = "cancelled";
  } catch {
    /* Unavailable or malformed browser storage leaves the fixtures intact. */
  }
  return lots;
}
export function getPage(): PageName {
  return (
    (location.hash.match(
      /^#\/(home|activity|wallet|seller|audit|login|register)$/,
    )?.[1] as PageName) || "home"
  );
}
function useModel(preview: boolean) {
  const [lots, setLots] = useState<Lot[]>(() => (preview ? readLots() : []));
  const [lang, setLang] = useState<Language>("EN");
  const [role, setRole] = useState<Role>("Collector A");
  const [page, setPage] = useState(getPage);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [wallet, setWallet] = useState<Record<Role, number>>({
    "Collector A": 90000,
    "Collector B": 75000,
    Auctioneer: 0,
    Guest: 0,
  });
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
      ?.setAttribute("content", theme === "dark" ? "#181817" : "#faf9f6");
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
  function saveLots(next: Lot[]) {
    setLots(next);
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          newLots: next.filter((l) => l.seller === "Auctioneer"),
          cancelled: next
            .filter((l) => l.status === "cancelled")
            .map((l) => l.id),
        }),
      );
      return "";
    } catch {
      return "Browser storage is unavailable. This lot will only remain for this session.";
    }
  }
  function bid(id: string, value: number) {
    const lot = lots.find((l) => l.id === id)!;
    const minimum = lot.bids.length ? current(lot) + lot.increment : lot.start;
    if (!role.startsWith("Collector"))
      return "Choose a collector demo account to bid.";
    if (status(lot) !== "live") return "This lot is not open for bidding.";
    if (lot.bids.at(-1)?.person === role)
      return "You are already the highest bidder.";
    if (!Number.isFinite(value) || value < minimum)
      return "Bid below the minimum: " + money(minimum);
    if (value > wallet[role]) return "Insufficient demo wallet balance.";
    setLots(
      lots.map((l) =>
        l.id === id ? { ...l, bids: [...l.bids, { person: role, value }] } : l,
      ),
    );
    return "Demo bid accepted — you are leading.";
  }
  return {
    lots,
    saveLots,
    lang,
    setLang,
    role,
    setRole,
    page,
    go,
    activeId,
    setActiveId,
    accountOpen,
    setAccountOpen,
    wallet,
    setWallet,
    now,
    theme,
    toggleTheme,
    bid,
  };
}
const Context = createContext<ReturnType<typeof useModel> | null>(null);
export function HausProvider({
  children,
  preview = true,
}: {
  children: ReactNode;
  preview?: boolean;
}) {
  const model = useModel(preview);
  return <Context.Provider value={model}>{children}</Context.Provider>;
}
export function useHaus() {
  const model = useContext(Context);
  if (!model) throw Error("HausProvider missing");
  return model;
}
