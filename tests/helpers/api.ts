import { APIRequestContext } from "@playwright/test";

export const CORE_API = "http://localhost:8084";
export const WC_API = "http://localhost:8084/commons";

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

export async function createPendingSong(request: APIRequestContext, jwt: string, title: string) {
  const resp = await request.post(`${WC_API}/songs`, {
    headers: { Authorization: `Bearer ${jwt}` },
    data: { title, writer: "Spec Writer", songKey: "C", chordPro: "Verse 1\n[C]A line for the spec", certified: true }
  });
  return await resp.json();
}

export async function createReport(request: APIRequestContext, contentText: string) {
  const resp = await request.post(`${WC_API}/reports`, { data: { contentType: "song", contentText, reporterRole: "The copyright owner (writer or publisher)", details: "Spec-created report", name: "Spec Tester", email: "spec@example.com", signature: "Spec Tester" } });
  return await resp.json();
}
