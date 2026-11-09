import { test, expect } from "@playwright/test";
import { execFileSync } from "child_process";
import { CORE_API, WC_API } from "./helpers/api";

const BALLAD = "The Ballad of the Cross";
const OTHER = "Come Fill My Heart";

/** Point one seeded song at the signed-in demo user, so the spec is that user for this song only. Local commons only. */
function claimAsUploader(songId: string, userId: string) {
  const script = `
    const fs = require("fs");
    const mysql = require("mysql2/promise");
    const env = fs.readFileSync("/home/charlie/Code/WC/Api/.env", "utf8");
    const line = env.split(/\\n/).find((l) => l.startsWith("COMMONS_CONNECTION_STRING="));
    if (!line) throw new Error("COMMONS_CONNECTION_STRING missing");
    const url = line.slice("COMMONS_CONNECTION_STRING=".length).trim().replace(/^["']|["']$/g, "");
    const host = new URL(url).hostname;
    if (host !== "localhost" && host !== "127.0.0.1") throw new Error("refusing non-local database");
    (async () => {
      const conn = await mysql.createConnection(url);
      const [res] = await conn.execute("update assets set publisherUserId = ? where id = ?", [process.env.CLAIM_USER, process.env.CLAIM_SONG]);
      if (!res.affectedRows) throw new Error("song was not in the local commons database");
      await conn.end();
    })().catch((err) => { console.error(err.message); process.exit(1); });
  `;
  execFileSync("node", ["-e", script], {
    cwd: "/home/charlie/Code/WC/Api",
    env: { ...process.env, NODE_PATH: "/home/charlie/Code/WC/Api/node_modules", CLAIM_USER: userId, CLAIM_SONG: songId },
    stdio: "pipe"
  });
}

test("the uploader can pick their song as a translation original when the license blocks everyone else", async ({ page, request }) => {
  const list = await (await request.get(`${WC_API}/songs`)).json();
  const ballad = list.find((s: { title: string }) => s.title === BALLAD);
  const other = list.find((s: { title: string }) => s.title === OTHER);
  expect(ballad?.id, BALLAD).toBeTruthy();
  expect(other?.id, OTHER).toBeTruthy();

  const login = await (await request.post(`${CORE_API}/membership/users/login`, { data: { email: "demo@b1.church", password: "password", appName: "WorshipCommons" } })).json();
  claimAsUploader(ballad.id, login.user.id);

  await page.goto("/upload");
  await page.getByTestId("submission-type").locator('input[value="translation"]').check();
  const picker = page.getByTestId("parent-song");

  await page.getByTestId("parent-search").fill("Ballad of the Cross");
  const mine = picker.locator(`option[value="${ballad.id}"]`);
  await expect(mine).toHaveCount(1);
  await expect(mine).toBeEnabled();

  await page.getByTestId("parent-search").fill("Come Fill My Heart");
  const closed = picker.locator(`option[value="${other.id}"]`);
  await expect(closed).toHaveCount(1);
  await expect(closed).toBeDisabled();
  await expect(closed).toContainText("need the writer");

  await page.getByTestId("submission-type").locator('input[value="arrangement"]').check();
  await page.getByTestId("parent-search").fill("Ballad of the Cross");
  const arranged = picker.locator(`option[value="${ballad.id}"]`);
  await expect(arranged).toHaveCount(1);
  await expect(arranged).toBeDisabled();
});
