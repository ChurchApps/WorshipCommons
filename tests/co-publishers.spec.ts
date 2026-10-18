import { test, expect } from "@playwright/test";
import { adminJwt, CORE_API, songIdByTitle, WC_API } from "./helpers/api";

const TITLE = "Amazing Grace";

test("an admin makes the demo user a co-publisher, and the song shows on their My songs", async ({ page, request }) => {
  const login = await (await request.post(`${CORE_API}/membership/users/login`, { data: { email: "demo@b1.church", password: "password" } })).json();
  const userId: string = login.user.id;
  const admin = { Authorization: `Bearer ${await adminJwt(request)}` };
  const id = await songIdByTitle(request, TITLE);
  const [row] = (await (await request.get(`${WC_API}/admin/assets?q=${id}`, { headers: admin })).json()).filter((a: { id: string }) => a.id === id);
  const before: string[] = (row.publishers || []).map((p: { id: string }) => p.id);
  expect(before).not.toContain(userId);

  try {
    // a stand-in primary keeps the demo user a co-publisher, not the uploader
    const primary = before[0] || "AAAAAAAAAAA";
    const set = await request.post(`${WC_API}/admin/assets/${id}/publishers`, { headers: admin, data: { userIds: [primary, userId] } });
    expect(set.ok()).toBeTruthy();
    expect((await set.json()).publishers.map((p: { id: string }) => p.id)).toEqual([primary, userId]);

    const mine = await (await request.get(`${WC_API}/songs/mine`, { headers: { Authorization: `Bearer ${login.user.jwt}` } })).json();
    expect(mine.map((s: { id: string }) => s.id)).toContain(id);

    await page.goto("/my-songs");
    const card = page.getByTestId("my-song").filter({ hasText: TITLE });
    await expect(card.getByTestId("my-song-status")).toHaveText("Live");
    await expect(card.getByTestId("propose-change")).toHaveAttribute("href", `/songs/${id}/edit`);
  } finally {
    await request.post(`${WC_API}/admin/assets/${id}/publishers`, { headers: admin, data: { userIds: before } });
  }
  const after = (await (await request.get(`${WC_API}/admin/assets?q=${id}`, { headers: admin })).json()).find((a: { id: string }) => a.id === id);
  expect((after.publishers || []).map((p: { id: string }) => p.id)).toEqual(before);
});
