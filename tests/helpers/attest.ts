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
}

/** A proposal to someone else's song: the proposer vouches for their change, not for authorship. */
export async function agreeContribution(page: Page) {
  await page.getByTestId("contributionAgreed").check();
}
