import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useSession } from "./session";
import { AuthPage } from "./AuthPage";
import { LotsPage, LotPage } from "./LotsPage";
import { WalletPage } from "./WalletPage";

import "./styles.css";
export default function LegacyApp() {
  const { session, logout } = useSession();
  return (
    <>
      <header>
        <Link className="brand" to="/lots">
          <span className="brand-mark">a.</span> Auction House
        </Link>
        <nav aria-label="Main navigation">
          <NavLink to="/lots">Explore</NavLink>
          <NavLink to="/wallet">Wallet</NavLink>
          {session ? (
            <button className="secondary" onClick={logout}>
              Sign out
            </button>
          ) : (
            <NavLink to="/login">Sign in</NavLink>
          )}
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/lots" replace />} />
          <Route path="/lots" element={<LotsPage />} />
          <Route path="/lots/:id" element={<LotPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route
            path="*"
            element={
              <section className="panel">
                <h1>Page not found</h1>
                <Link to="/lots">Explore lots</Link>
              </section>
            }
          />
        </Routes>
      </main>
      <footer>
        <span>Auction House</span>
        <span>Art, with a new chapter.</span>
      </footer>
    </>
  );
}
