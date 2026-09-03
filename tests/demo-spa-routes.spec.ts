import { test, expect } from "@playwright/test";

// Vite always serves index.html, so this spec proves the React routes exist.
// Production 200s for the same paths come from tools/prerender.mjs writing
// build/<route>/index.html (and CloudFront 403/404 → /index.html as fallback).

const ROUTES: { path: string; heading: string }[] = [
  { path: "/license/", heading: "One page. Zero strings." },
  { path: "/terms", heading: "How this site works" },
  { path: "/terms/", heading: "How this site works" },
  { path: "/new", heading: "New songs" },
  { path: "/new/", heading: "New songs" },
  { path: "/upload", heading: "Give the church something to sing" },
  { path: "/call-for-songs", heading: "Write a song the church can actually sing" },
  { path: "/call-for-songs/", heading: "Write a song the church can actually sing" },
  { path: "/songs", heading: "Find what your church will sing" },
  { path: "/songs/", heading: "Find what your church will sing" }
];

test("public SPA routes render instead of Page not found, with or without a trailing slash", async ({ page }) => {
  for (const { path, heading } of ROUTES) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }), path).toContainText(heading);
    await expect(page.getByText("Page not found."), path).toHaveCount(0);
  }

  await page.goto("/");
  await page.locator(".nav").getByRole("link", { name: "The License" }).click();
  await expect(page).toHaveURL(/\/license\/?$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("One page. Zero strings.");
});
