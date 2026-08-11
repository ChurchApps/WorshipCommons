import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate(params.get("next") || "/");
    } catch {
      setError("That email and password didn't match — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="wrap-narrow" style={{ maxWidth: 480 }}>
      <div className="page-head">
        <span className="eyebrow">Sign in</span>
        <h1>Welcome back</h1>
        <p className="lede">Sign in with your ChurchApps account to share a song or review submissions.</p>
      </div>
      <form className="card" style={{ padding: 32 }} onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input type="email" id="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input type="password" id="password" required value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {error && <p className="hint" style={{ color: "var(--secondary)", fontWeight: 600, marginBottom: 16 }} data-testid="login-error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: "100%" }}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}
