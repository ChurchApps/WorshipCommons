import { test, expect } from "@playwright/test";
import { WC_API } from "./helpers/api";

let PATH = "";
let BPM = 0;

test.beforeAll(async ({ request }) => {
  const list = await (await request.get(`${WC_API}/songs`)).json();
  const song = list.find((s: { title: string }) => s.title === "Amazing Grace");
  if (!song) throw new Error("Seed song not found: Amazing Grace");
  PATH = `/songs/${song.id}`;
  BPM = song.bpm;
});

test.describe("practice card", () => {
  test("shows the song BPM and the tonic of the selected key", async ({ page }) => {
    await page.goto(PATH);
    await expect(page.getByTestId("metronome-bpm")).toHaveText(`${BPM} BPM`);
    await expect(page.getByTestId("pitch-pipe")).toHaveText("Play G");

    await page.selectOption("#transpose", "A");
    await expect(page.getByTestId("pitch-pipe")).toHaveText("Play A");
    await page.selectOption("#transpose", "Bb");
    await expect(page.getByTestId("pitch-pipe")).toHaveText("Play Bb");
  });

  test("metronome follows the tempo slider", async ({ page }) => {
    await page.goto(PATH);
    await page.locator("#tempo").fill("150");
    await expect(page.getByTestId("metronome-bpm")).toHaveText(`${Math.round(BPM * 1.5)} BPM`);
  });

  test("metronome and pitch pipe play without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", e => errors.push(e.message));

    await page.goto(PATH);
    const toggle = page.getByTestId("metronome-toggle");
    await toggle.click();
    await expect(toggle).toHaveText("■ Stop metronome");
    await page.getByTestId("pitch-pipe").click();
    await toggle.click();
    await expect(toggle).toHaveText("▶ Metronome");

    expect(errors).toEqual([]);
  });
});
