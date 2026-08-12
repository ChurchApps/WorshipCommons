import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import { corePost } from "../api";
import { usePageMeta } from "../seo";

type Mode = "signin" | "register" | "forgot" | "code" | "setpw";
const APP = { appName: "WorshipCommons", appUrl: window.location.origin };

const HEADS: Record<Mode, { eyebrow: string; title: string; lede: string }> = {
  signin: { eyebrow: "Sign in", title: "Welcome back", lede: "Sign in with your ChurchApps account to share a song or review submissions." },
  register: { eyebrow: "Create account", title: "Join the commons", lede: "One free account to share songs and track your submissions." },
  forgot: { eyebrow: "Reset password", title: "Forgot your password?", lede: "Enter your email and we'll send you a 6-digit code." },
  code: { eyebrow: "Check your email", title: "Enter the code", lede: "We emailed a 6-digit code — type it below." },
  setpw: { eyebrow: "Almost there", title: "Set your password", lede: "Pick a password of at least 8 characters." }
};

export default function Login() {
  usePageMeta("Sign in — WorshipCommons");
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>("signin");
  const [form, setForm] = useState({ email: "", password: "", firstName: "", lastName: "", code: "", newPassword: "", verifyPassword: "" });
  const [authGuid, setAuthGuid] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));
  const go = (m: Mode) => { setMode(m); setError(""); };
  const finish = async (email: string, password: string) => {
    await login(email, password);
    navigate(params.get("next") || "/");
  };

  const run = async (fn: () => Promise<void>, friendly?: string) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(friendly || (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signin") run(() => finish(form.email, form.password), "That email and password didn't match — try again.");
    else if (mode === "register") run(async () => {
      const resp = await corePost("/membership/users/register", { firstName: form.firstName, lastName: form.lastName, email: form.email, ...APP });
      if (resp.errors?.length) setError(resp.errors[0]);
      else if (resp.mailConfigured === false && resp.authGuid) { setAuthGuid(resp.authGuid); setMode("setpw"); }
      else setMode("code");
    });
    else if (mode === "forgot") run(async () => {
      const resp = await corePost("/membership/users/forgot", { userEmail: form.email });
      if (resp.errors?.length) setError(resp.errors[0]);
      else if (resp.emailed) setMode("code");
      else setError("We couldn't find an account with that email.");
    });
    else if (mode === "code") run(async () => {
      const resp = await corePost("/membership/users/verifyCode", { email: form.email, code: form.code });
      if (resp.authGuid) { setAuthGuid(resp.authGuid); setMode("setpw"); }
      else setError("That code didn't match — check the email and try again.");
    }, "That code didn't match — check the email and try again.");
    else if (mode === "setpw") {
      if (form.newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
      if (form.newPassword !== form.verifyPassword) { setError("Passwords don't match."); return; }
      run(async () => {
        const resp = await corePost("/membership/users/setPasswordGuid", { authGuid, newPassword: form.newPassword, ...APP });
        if (!resp.success) { setError("That code has expired — request a new one."); setMode("forgot"); return; }
        await finish(form.email, form.newPassword);
      });
    }
  };

  const head = HEADS[mode];
  const links: { label: string; to: Mode; testId: string }[] =
    mode === "signin" ? [{ label: "Create an account", to: "register", testId: "register-link" }, { label: "Forgot password?", to: "forgot", testId: "forgot-link" }]
      : mode === "setpw" ? []
        : [{ label: "Back to sign in", to: "signin", testId: "signin-link" }];

  return (
    <main className="wrap-narrow" style={{ maxWidth: 480 }}>
      <div className="page-head">
        <span className="eyebrow">{head.eyebrow}</span>
        <h1>{head.title}</h1>
        <p className="lede">{head.lede}</p>
      </div>
      <form className="card" style={{ padding: 32 }} onSubmit={submit}>
        {mode === "register" && (
          <div className="field-row field" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label htmlFor="firstName">First name</label>
              <input type="text" id="firstName" required autoFocus autoComplete="given-name" value={form.firstName} onChange={e => set("firstName", e.target.value)} />
            </div>
            <div>
              <label htmlFor="lastName">Last name</label>
              <input type="text" id="lastName" required autoComplete="family-name" value={form.lastName} onChange={e => set("lastName", e.target.value)} />
            </div>
          </div>
        )}
        {(mode === "signin" || mode === "register" || mode === "forgot") && (
          <div className="field">
            <label htmlFor="email">Email</label>
            <input type="email" id="email" required autoFocus={mode !== "register"} autoComplete="email" value={form.email} onChange={e => set("email", e.target.value)} />
          </div>
        )}
        {mode === "signin" && (
          <div className="field">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" required autoComplete="current-password" value={form.password} onChange={e => set("password", e.target.value)} />
          </div>
        )}
        {mode === "code" && (
          <div className="field">
            <label htmlFor="code">6-digit code</label>
            <input type="text" id="code" required autoFocus inputMode="numeric" maxLength={6} pattern="\d{6}" autoComplete="one-time-code" style={{ letterSpacing: "0.4em", textAlign: "center", fontSize: "1.25rem" }} value={form.code} onChange={e => set("code", e.target.value.replace(/\D/g, ""))} />
          </div>
        )}
        {mode === "setpw" && (
          <>
            <div className="field">
              <label htmlFor="newPassword">New password</label>
              <input type="password" id="newPassword" required autoFocus autoComplete="new-password" value={form.newPassword} onChange={e => set("newPassword", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="verifyPassword">Verify password</label>
              <input type="password" id="verifyPassword" required autoComplete="new-password" value={form.verifyPassword} onChange={e => set("verifyPassword", e.target.value)} />
            </div>
          </>
        )}
        {error && <p className="hint" style={{ color: "var(--secondary)", fontWeight: 600, marginBottom: 16 }} data-testid="login-error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Please wait…"
            : mode === "signin" ? "Sign in"
              : mode === "register" ? "Create account"
                : mode === "forgot" ? "Send code"
                  : mode === "code" ? "Verify code"
                    : "Set password & sign in"}
        </button>
        {links.length > 0 && (
          <p className="hint" style={{ textAlign: "center", marginTop: 16, marginBottom: 0 }}>
            {links.map((l, i) => (
              <span key={l.to}>
                {i > 0 && " · "}
                <button type="button" data-testid={l.testId} onClick={() => go(l.to)} style={{ background: "none", border: 0, padding: 0, color: "var(--primary)", fontWeight: 600, cursor: "pointer", font: "inherit" }}>{l.label}</button>
              </span>
            ))}
          </p>
        )}
      </form>
    </main>
  );
}
