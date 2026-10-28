import { useSession } from "../session";
import { useHaus } from "./model";
import { authTranslations, translations } from "./translations";
import { Modal } from "./shared";
import type { PageName, Role } from "./types";
export function SiteHeader({ connected = false }: { connected?: boolean }) {
  const { session, logout } = useSession();
  const { lang, setLang, go, theme, toggleTheme, role, setAccountOpen } =
    useHaus();
  return (
    <header className="hs-header">
      <div className="hs-languages">
        <button
          aria-pressed={lang === "EN"}
          id="locale-en"
          type="button"
          onClick={() => setLang("EN")}
        >
          EN
        </button>
        <span aria-hidden="true" />
        <button
          aria-pressed={lang === "PT"}
          id="locale-pt"
          type="button"
          onClick={() => setLang("PT")}
        >
          PT
        </button>
      </div>
      <button className="hs-brand" onClick={() => go("home")} type="button">
        HAUS SAMPAIO
      </button>
      <nav className="hs-header-actions" aria-label="Account and appearance">
        <button
          className="hs-theme-toggle"
          id="theme-toggle"
          type="button"
          aria-pressed={theme === "dark"}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          onClick={toggleTheme}
        >
          <span className="hs-theme-icon" aria-hidden="true">
            ◐
          </span>
          <span id="theme-toggle-label">
            {authTranslations[lang][theme === "dark" ? "light" : "dark"]}
          </span>
        </button>
        <span className="hs-header-separator" aria-hidden="true" />
        {!connected && (
          <button
            className="hs-demo-link"
            type="button"
            onClick={() => setAccountOpen(true)}
          >
            <span id="demo-role-label">
              DEMO /{" "}
              {role === "Auctioneer"
                ? "SELLER"
                : role === "Guest"
                  ? "GUEST"
                  : "COLLECTOR"}
            </span>
          </button>
        )}
        {connected && session ? (
          <button
            className="hs-login"
            type="button"
            onClick={() => {
              logout();
              go("home");
            }}
          >
            {lang === "PT" ? "SAIR" : "SIGN OUT"}
          </button>
        ) : (
          <button
            className="hs-login"
            type="button"
            onClick={() => go("login")}
          >
            <span id="login-label">{translations[lang].login}</span>
            <span aria-hidden="true">↗</span>
          </button>
        )}
      </nav>
    </header>
  );
}
export function SiteFooter({ connected = false }: { connected?: boolean }) {
  const { session } = useSession();
  const { go, page } = useHaus();
  const links: [PageName, string][] = [
    ["home", "AUCTIONS"],
    ["activity", "MY BIDS"],
    ["wallet", "WALLET"],
    ["seller", "SELLER STUDIO"],
    ["audit", "PUBLIC AUDIT"],
  ];
  return (
    <footer className="hs-footer">
      <div className="hs-footer-top">
        <button className="hs-footer-brand" onClick={() => go("home")}>
          HAUS SAMPAIO
        </button>
        <nav className="hs-footer-links">
          {links
            .filter(
              ([target]) =>
                !connected ||
                ["home", "wallet"].includes(target) ||
                (target === "seller" && session?.user.role === "auctioneer") ||
                (target === "activity" && session?.user.role === "bidder"),
            )
            .map(([target, label]) => (
              <button
                key={target}
                aria-current={page === target ? "page" : undefined}
                onClick={() => go(target)}
              >
                {label}
              </button>
            ))}
        </nav>
      </div>
      <div className="hs-footer-bottom">
        <span>© 2026 HAUS SAMPAIO</span>
        <span>
          {connected
            ? "HAUS SAMPAIO / AUCTIONS"
            : "FRONTEND CONCEPT / DEMONSTRATION ONLY — NO ACTUAL SALES"}
        </span>
      </div>
    </footer>
  );
}
export function AccountDialog() {
  const { setAccountOpen, role, setRole, go } = useHaus();
  return (
    <Modal
      id="account"
      className="hs-preview-account open"
      labelledBy="demo-account-title"
      onClose={() => setAccountOpen(false)}
    >
      <div className="hs-preview-account-inner">
        <button
          className="hs-close-account"
          type="button"
          aria-label="Close demo profiles"
          onClick={() => setAccountOpen(false)}
        >
          ×
        </button>
        <p className="hs-account-kicker">PROTOTYPE / NO AUTHENTICATION</p>
        <h2 id="demo-account-title">EXPLORE THE DEMO</h2>
        <p>
          Select a profile to preview the interface. No account is created and
          no real login or payment takes place.
        </p>
        <div id="account-roles">
          {(
            ["Collector A", "Collector B", "Auctioneer", "Guest"] as Role[]
          ).map((r) => (
            <button
              key={r}
              className="hs-account-option"
              type="button"
              onClick={() => {
                setRole(r);
                setAccountOpen(false);
              }}
            >
              <span>{r}</span>
              <span>{role === r ? "SELECTED" : "↗"}</span>
            </button>
          ))}
        </div>
        <div className="hs-account-actions">
          {(["wallet", "seller", "audit"] as const).map((p, i) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setAccountOpen(false);
                go(p);
              }}
            >
              {["WALLET", "SELLER STUDIO", "PUBLIC AUDIT"][i]}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
