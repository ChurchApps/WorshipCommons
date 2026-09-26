import type { Page } from "@playwright/test";

export const GRANT_TESTIDS = [
  "certifyAdult",
  "certifyWrote",
  "certifyCowriters",
  "certifyClear",
  "certifyForever",
  "certifyHuman"
] as const;

/** Check every worship-grant box on the upload / edit form. */
export async function checkGrant(page: Page) {
  for (const id of GRANT_TESTIDS) await page.getByTestId(id).check();
  await giveMelody(page);
}

/** A new song needs some way to learn the tune; a video link is the lightest. Leaves a link or file already given alone. */
export async function giveMelody(page: Page) {
  const video = page.getByTestId("video-url");
  if (await video.count() && !(await video.inputValue())) await video.fill("https://www.youtube.com/watch?v=spec");
}

/** A proposal to someone else's song: the proposer vouches for their change, not for authorship. */
export async function agreeContribution(page: Page) {
  await page.getByTestId("contributionAgreed").check();
}
