import { test, expect } from "@playwright/test";
import { songIdByTitle } from "./helpers/api";

test("hovering a chord shows guitar and piano diagrams for the shape being played", async ({ page, request }) => {
  await page.goto(`/songs/${await songIdByTitle(request, "Amazing Grace")}`);
  const pop = page.getByTestId("chord-pop");
  await expect(pop).toHaveCount(0);

  const d7 = page.locator(".stanza .seg .c", { hasText: /^D$/ }).first();
  await d7.hover();
  await expect(pop).toBeVisible();
  await expect(pop.locator(".cd-col b")).toHaveText(["D", "D"]);
  // D is three notes on the keyboard; open D has three fretted dots
  await expect(pop.locator(".cd-piano .pk.on")).toHaveCount(3);
  await expect(pop.locator(".cd-guitar .cd-dot")).toHaveCount(3);

  await page.mouse.move(0, 0);
  await expect(pop).toHaveCount(0);

  // capo 2 in G: the written D becomes a C shape on guitar; the piano still sounds D
  await page.selectOption("#capo", "2");
  await page.locator(".stanza .seg .c", { hasText: /^C$/ }).first().hover();
  await expect(pop.locator(".cd-col b")).toHaveText(["C", "D"]);

  // keyboard users get it on focus too
  await page.mouse.move(0, 0);
  const first = page.locator(".stanza .seg .c[tabindex]").first();
  await first.focus();
  await expect(pop.locator(".cd-col b").first()).toHaveText(await first.innerText());
});
