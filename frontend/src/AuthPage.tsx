import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api, message } from "./api";
import { useSession } from "./session";

export function AuthPage() {
  const { session, login, notice } = useSession();
  const navigate = useNavigate();
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [role, setRole] = useState("bidder");
  if (session) return <Navigate to="/wallet" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (register)
        await api("/auth/register", undefined, {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            password,
            role,
          }),
        });
      await login(email.trim(), password);
      setPassword("");
      navigate("/wallet");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth panel">
      <p className="eyebrow">YOUR PLACE IN THE AUCTION</p>
      <h1>{register ? "Create an account" : "Welcome back"}</h1>
      <p>
        {register
          ? "Join as a bidder or an auctioneer."
          : "Sign in to view your wallet."}
      </p>
      {notice && <p role="status">{notice}</p>}
      <form onSubmit={submit}>
        {register && (
          <label>
            Name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </label>
        )}
        <label>
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            required
            type="password"
            minLength={8}
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={register ? "new-password" : "current-password"}
          />
        </label>
        {register && (
          <label>
            Account type
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="bidder">Bidder</option>
              <option value="auctioneer">Auctioneer</option>
            </select>
          </label>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button disabled={busy} type="submit">
          {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
        </button>
      </form>
      <button
        className="text-button"
        disabled={busy}
        onClick={() => {
          setRegister(!register);
          setError("");
        }}
      >
        {register
          ? "Already registered? Sign in"
          : "New here? Create an account"}
      </button>
    </section>
  );
}
