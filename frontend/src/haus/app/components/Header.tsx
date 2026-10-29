import { useTranslation } from "@/hooks/useTranslation";
import { AppLink } from "@/haus/app/routing/AppLink";
import { matchPath, useLocation } from "react-router";
import { cn } from "../../../lib/utils";
import { LogOut, Moon, Sun } from "lucide-react";
import { navigationItemStyles } from "../../../components/ui/navigation-item";
import { Button } from "../../../components/ui/button";
import { useSession } from "../../../hooks/useSession";
import { usePreferences } from "../../../hooks/usePreferences";

export function Navigation({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { session } = useSession();
  const { pathname } = useLocation();
  const isCurrent = (path: string) => {
    if (window.location.pathname !== "/") return false;
    if (path === "/home") return pathname === "/" || pathname === "/home";
    return !!matchPath(`${path}/*`, pathname);
  };
  return (
    <>
      <AppLink
        className={className}
        to="/home"
        aria-current={isCurrent("/home") ? "page" : undefined}
      >
        {t("AUCTIONS")}
      </AppLink>
      {session?.user.role === "bidder" && (
        <AppLink
          className={className}
          to="/activity"
          aria-current={isCurrent("/activity") ? "page" : undefined}
        >
          {t("MY BIDS")}
        </AppLink>
      )}
      {session && (
        <AppLink
          className={className}
          to="/wallet"
          aria-current={isCurrent("/wallet") ? "page" : undefined}
        >
          {t("WALLET")}
        </AppLink>
      )}
      {session?.user.role === "auctioneer" && (
        <AppLink
          className={className}
          to="/seller"
          aria-current={isCurrent("/seller") ? "page" : undefined}
        >
          {t("SELLER STUDIO")}{" "}
        </AppLink>
      )}
      <AppLink
        className={className}
        to="/audit"
        aria-current={isCurrent("/audit") ? "page" : undefined}
      >
        {t("PUBLIC AUDIT")}
      </AppLink>
    </>
  );
}
export function Header() {
  const { t } = useTranslation();
  const { lang, setLang, theme, toggleTheme } = usePreferences();
  const { session, logout } = useSession();
  const roles = {
    auctioneer: t("Auctioneer"),
    bidder: t("Bidder"),
    admin: t("Admin"),
  };
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
        <AppLink
          to="/home"
          className="font-display text-center text-sm font-semibold tracking-widest md:text-xl"
        >
          HAUS SAMPAIO
        </AppLink>
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
                aria-label={t("Sign out")}
                title={t("Sign out")}
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
              <AppLink to="/login">{t("LOG IN")}</AppLink>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={
              theme === "dark"
                ? t("Switch to light mode")
                : t("Switch to dark mode")
            }
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </div>
        {!session && (
          <AppLink
            className="col-span-3 text-center text-xs text-muted-foreground sm:hidden"
            to="/login"
          >
            {t("LOG IN")}
          </AppLink>
        )}
      </div>
      <nav
        aria-label={t("Main navigation")}
        className="flex flex-wrap justify-center gap-x-6 border-t px-5"
      >
        <Navigation className={navigationItemStyles} />
      </nav>
    </header>
  );
}
export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-footer-foreground/20 bg-footer py-12 text-footer-foreground">
      <div className="mx-auto max-w-screen-2xl px-6 md:px-12">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
          <AppLink
            to="/home"
            className="inline-flex items-center gap-3 font-display font-semibold tracking-widest"
          >
            <span
              aria-hidden="true"
              className="inline-block h-8 w-7 shrink-0 bg-current"
              style={{
                mask: 'url("/favicon.svg") center / contain no-repeat',
                WebkitMask: 'url("/favicon.svg") center / contain no-repeat',
              }}
            />
            HAUS SAMPAIO
          </AppLink>
          <nav
            aria-label={t("Footer navigation")}
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
          <span>
            © {new Date().getFullYear()} {t("- HS - ALL RIGHTS RESERVED")}{" "}
          </span>
          <span>{t("developed by GADIEL SAMPAIO")}</span>
        </div>
      </div>
    </footer>
  );
}
