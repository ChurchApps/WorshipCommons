import { APIRequestContext } from "@playwright/test";

export const CORE_API = "http://localhost:8084";
export const WC_API = "http://localhost:8084/commons";
export const CONTENT = "http://localhost:8084/content/commons";

const auth = (jwt: string) => ({ Authorization: `Bearer ${jwt}` });

async function ok(resp: import("@playwright/test").APIResponse, what: string) {
  if (!resp.ok()) throw new Error(`${what} failed: ${resp.status()} ${await resp.text()}`);
  return await resp.json();
}

export async function songIdByTitle(request: APIRequestContext, title: string): Promise<string> {
  const list = await (await request.get(`${WC_API}/songs`)).json();
  const song = list.find((s: { title: string }) => s.title === title);
  if (!song) throw new Error(`Seed song not found: ${title}`);
  return song.id;
}

export async function userJwt(request: APIRequestContext): Promise<string> {
  const resp = await request.post(`${CORE_API}/membership/users/login`, { data: { email: "demo@b1.church", password: "password" } });
  const body = await resp.json();
  return body.user.jwt;
}

// moderation moved to B1Admin: specs drive it through the API with the church jwt that carries Server/Admin
export async function adminJwt(request: APIRequestContext): Promise<string> {
  const resp = await request.post(`${CORE_API}/membership/users/login`, { data: { email: "demo@b1.church", password: "password", appName: "WorshipCommons" } });
  const body = await resp.json();
  const church = (body.userChurches || []).find((uc: any) => uc.jwt && (uc.apis || []).some((api: any) => (api.permissions || []).some((p: any) => p.contentType === "Server" && p.action === "Admin")));
  if (!church) throw new Error("demo@b1.church has no Server/Admin claim");
  return church.jwt;
}

export async function approveSubmission(request: APIRequestContext, id: string) {
  const jwt = await adminJwt(request);
  return await ok(await request.post(`${WC_API}/admin/submissions/${id}/approve`, { headers: auth(jwt), data: {} }), `approve ${id}`);
}

export async function rejectSubmission(request: APIRequestContext, id: string) {
  const jwt = await adminJwt(request);
  return await ok(await request.post(`${WC_API}/admin/submissions/${id}/reject`, { headers: auth(jwt), data: { reason: "other", note: "spec" } }), `reject ${id}`);
}

/** Admin detail — carries the signed pending-file urls and the token-bearing product preview url. */
export async function submissionDetail(request: APIRequestContext, id: string) {
  const jwt = await adminJwt(request);
  return await ok(await request.get(`${WC_API}/admin/submissions/${id}`, { headers: auth(jwt) }), `submission ${id}`);
}

/** The pending submission for an asset id or asset name, from the admin queue. */
export async function pendingSubmissionFor(request: APIRequestContext, assetIdOrName: string) {
  const jwt = await adminJwt(request);
  const rows = await ok(await request.get(`${WC_API}/admin/submissions`, { headers: auth(jwt) }), "admin queue");
  const row = rows.find((r: any) => r.assetId === assetIdOrName || r.assetName === assetIdOrName);
  if (!row) throw new Error(`No pending submission for ${assetIdOrName}`);
  return row;
}

export async function mySubmissions(request: APIRequestContext) {
  const jwt = await userJwt(request);
  return await ok(await request.get(`${WC_API}/submissions/mine`, { headers: auth(jwt) }), "submissions/mine");
}

export async function mySubmissionFor(request: APIRequestContext, assetName: string) {
  const rows = await mySubmissions(request);
  const row = rows.find((r: any) => r.assetName === assetName);
  if (!row) throw new Error(`Not in /submissions/mine: ${assetName}`);
  return row;
}

export async function createPendingSong(request: APIRequestContext, jwt: string, title: string) {
  const draft = await ok(await request.post(`${WC_API}/submissions`, {
    headers: auth(jwt),
    data: { assetType: "song", payload: { name: title, language: "English", license: "WC", detail: { writer: "Spec Writer", songKey: "C", chordPro: "Verse 1\n[C]A line for the spec", certified: true } } }
  }), "create draft");
  await ok(await request.post(`${WC_API}/submissions/${draft.submissionId}/submit`, { headers: auth(jwt), data: {} }), "submit draft");
  return draft as { submissionId: string; assetId: string };
}

export async function createReport(request: APIRequestContext, contentText: string) {
  const resp = await request.post(`${WC_API}/reports`, { data: { contentText, reason: "copyright", reporterRole: "The copyright owner (writer or publisher)", details: "Spec-created report", name: "Spec Tester", email: "spec@example.com", signature: "Spec Tester" } });
  return await resp.json();
}
