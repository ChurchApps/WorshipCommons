const DEFAULT_BASE_URL = "http://localhost:3104";
const CORE_API = "http://localhost:8084";
const ALLOWED_ENVIRONMENTS = ["demo", "dev"];

class VerifyEnvError extends Error {
  constructor(message) {
    super(message);
    this.name = "VerifyEnvError";
  }
}

function refuse(lines) {
  const body = Array.isArray(lines) ? lines.join("\n  ") : lines;
  throw new VerifyEnvError(
    [
      "",
      "========================================",
      "WorshipCommons tests refused to run.",
      `  ${body}`,
      "========================================",
      ""
    ].join("\n")
  );
}

function checkBaseUrl() {
  const raw = process.env.BASE_URL || DEFAULT_BASE_URL;
  let url;
  try {
    url = new URL(raw);
  } catch {
    refuse(`BASE_URL "${raw}" is not a valid URL.`);
  }
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    refuse([
      `BASE_URL "${raw}" is not local.`,
      "Tests only run against http://localhost:3104. Unset BASE_URL or point it at localhost."
    ]);
  }
}

async function checkCoreApi() {
  let health;
  try {
    const res = await fetch(`${CORE_API}/health`);
    if (!res.ok) refuse(`GET ${CORE_API}/health returned HTTP ${res.status}.`);
    health = await res.json();
  } catch (err) {
    if (err instanceof VerifyEnvError) throw err;
    refuse([
      `Could not reach the core Api at ${CORE_API}/health.`,
      `Error: ${err instanceof Error ? err.message : String(err)}`
    ]);
  }
  if (!ALLOWED_ENVIRONMENTS.includes(health.environment)) {
    refuse([
      `Core Api reports environment="${health.environment}" but must be one of: ${ALLOWED_ENVIRONMENTS.join(", ")}.`,
      "Tests log in with demo credentials and must never touch a real environment."
    ]);
  }
  if (!(health.modules ?? []).includes("membership")) {
    refuse("Core Api has no membership module loaded — login is impossible.");
  }
}

async function checkCommonsModule() {
  try {
    const res = await fetch(`${CORE_API}/commons/songs`);
    if (!res.ok) refuse(`GET ${CORE_API}/commons/songs returned HTTP ${res.status}.`);
    await res.json();
  } catch (err) {
    if (err instanceof VerifyEnvError) throw err;
    refuse([
      `Could not reach the commons module at ${CORE_API}/commons/songs.`,
      `Error: ${err instanceof Error ? err.message : String(err)}`
    ]);
  }
}

// Admin specs need demo@b1.church to carry the Server/Admin claim (church-0 Server Admins
// membership seeded by core Api's populateData.sql). The demo membership DB is shared mutable
// state, so fail fast with the remedy instead of letting every admin spec time out.
async function checkDemoServerAdmin() {
  let login;
  try {
    const res = await fetch(`${CORE_API}/membership/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "demo@b1.church", password: "password", appName: "WorshipCommons" })
    });
    if (!res.ok) refuse(`Demo login returned HTTP ${res.status}.`);
    login = await res.json();
  } catch (err) {
    if (err instanceof VerifyEnvError) throw err;
    refuse([`Demo login failed: ${err instanceof Error ? err.message : String(err)}`]);
  }
  const hasAdmin = (login.userChurches ?? []).some((uc) =>
    (uc.apis ?? []).some((api) => (api.permissions ?? []).some((p) => p.contentType === "Server" && p.action === "Admin"))
  );
  if (!hasAdmin) {
    refuse([
      "demo@b1.church has no Server/Admin claim, so every admin spec would fail.",
      "The demo membership DB has drifted. Fix: run `yarn reset-demo` in the core Api repo, restart the Api, and re-run."
    ]);
  }
}

export async function verifyEnv({ fullCheck } = {}) {
  checkBaseUrl();
  if (fullCheck) {
    await checkCoreApi();
    await checkCommonsModule();
    await checkDemoServerAdmin();
  }
}

export { VerifyEnvError };
