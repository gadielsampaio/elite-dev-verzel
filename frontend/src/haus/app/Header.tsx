import { cn } from "../../lib/utils";
import { LogOut, Moon, Sun } from "lucide-react";
import { navigationItemStyles } from "../../components/ui/navigation-item";
import { Button } from "../../components/ui/button";
import { useSession } from "../../session";
import { useHaus } from "../model";

export function Navigation({ className }: { className?: string }) {
  const { session } = useSession();
  const { lang, page } = useHaus();
  const pt = lang === "PT";
  return (
    <>
      <a
        className={className}
        href="/#/home"
        aria-current={page === "home" ? "page" : undefined}
      >
        {pt ? "LEILÕES" : "AUCTIONS"}
      </a>
      {session?.user.role === "bidder" && (
        <a
          className={className}
          href="/#/activity"
          aria-current={page === "activity" ? "page" : undefined}
        >
          {pt ? "MEUS LANCES" : "MY BIDS"}
        </a>
      )}
      {session && (
        <a
          className={className}
          href="/#/wallet"
          aria-current={page === "wallet" ? "page" : undefined}
        >
          {pt ? "CARTEIRA" : "WALLET"}
        </a>
      )}
      {session?.user.role === "auctioneer" && (
        <a
          className={className}
          href="/#/seller"
          aria-current={page === "seller" ? "page" : undefined}
        >
          SELLER STUDIO
        </a>
      )}
      <a
        className={className}
        href="/#/audit"
        aria-current={page === "audit" ? "page" : undefined}
      >
        {pt ? "AUDITORIA PÚBLICA" : "PUBLIC AUDIT"}
      </a>
    </>
  );
}
export function Header() {
  const { lang, setLang, theme, toggleTheme } = useHaus();
  const { session, logout } = useSession();
  const roles =
    lang === "PT"
      ? { auctioneer: "Leiloeiro", bidder: "Licitante", admin: "Administrador" }
      : { auctioneer: "Auctioneer", bidder: "Bidder", admin: "Admin" };
  return (
    <header className="border-b">
      <div
        className={`relative mx-auto grid max-w-screen-2xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-6 py-6 md:px-12 ${session ? "max-sm:pb-16" : ""}`}
      >
        <div className="flex items-center gap-1">
          {(["EN", "PT"] as const).map((language) => (
            <Button
              key={language}
              variant="ghost"
              size="sm"
              className="px-2 text-xs"
              aria-pressed={lang === language}
              onClick={() => setLang(language)}
            >
              {language}
            </Button>
          ))}
        </div>
        <a
          href="/#/home"
          className="font-display text-center text-sm font-semibold tracking-widest md:text-xl"
        >
          HAUS SAMPAIO
        </a>
        <div className="flex min-w-0 items-center justify-end gap-2">
          {session && (
            <div className="flex min-w-0 items-center gap-2 max-sm:absolute max-sm:inset-x-5 max-sm:bottom-3 max-sm:justify-center">
              <span
                className="truncate text-xs text-muted-foreground"
                title={`${session.user.name} – ${roles[session.user.role]}`}
              >
                {session.user.name} – {roles[session.user.role]}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={logout}
                aria-label={lang === "PT" ? "Sair" : "Sign out"}
                title={lang === "PT" ? "Sair" : "Sign out"}
              >
                <LogOut aria-hidden="true" />
              </Button>
            </div>
          )}
          {!session && (
            <Button
              asChild
              variant="link"
              className="hidden text-xs sm:inline-flex"
            >
              <a href="/#/login">{lang === "PT" ? "ENTRAR" : "LOG IN"}</a>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </div>
        {!session && (
          <a
            className="col-span-3 text-center text-xs text-muted-foreground sm:hidden"
            href="/#/login"
          >
            {lang === "PT" ? "ENTRAR" : "LOG IN"}
          </a>
        )}
      </div>
      <nav
        aria-label="Main navigation"
        className="flex flex-wrap justify-center gap-x-6 border-t px-5"
      >
        <Navigation className={navigationItemStyles} />
      </nav>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="border-t border-footer-foreground/20 bg-footer py-12 text-footer-foreground">
      <div className="mx-auto max-w-screen-2xl px-6 md:px-12">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
          <a
            href="/#/home"
            className="font-display font-semibold tracking-widest"
          >
            HAUS SAMPAIO
          </a>
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap gap-6 text-[10px]"
          >
            <Navigation
              className={cn(
                navigationItemStyles,
                "py-2 text-[10px] text-footer-foreground/60 sm:text-[10px] hover:border-footer-foreground hover:text-footer-foreground focus-visible:border-footer-foreground aria-[current=page]:border-footer-foreground aria-[current=page]:text-footer-foreground",
              )}
            />
          </nav>
        </div>
        <div className="mt-12 flex justify-between border-t border-footer-foreground/20 pt-6 text-[10px] text-footer-foreground/60">
          <span>© {new Date().getFullYear()} HAUS SAMPAIO</span>
          <span>HAUS SAMPAIO / AUCTIONS</span>
        </div>
      </div>
    </footer>
  );
}
