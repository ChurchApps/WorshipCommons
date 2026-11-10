# Tests

Three tiers, picked by when they run:

| Tier | When | Command |
|---|---|---|
| Smoke | By hand or in the nightly run, against the local stack | `SMOKE_BASE_URL=http://localhost:3104 yarn test:smoke` |
| Affected | Before pushing a PR branch | `yarn test:affected` |
| Full | The weekly full run, and before a release | `yarn test` |

**Smoke** (`tests/smoke/`, `playwright.smoke.config.ts`) runs anonymously against the local stack and only reads. WorshipCommons has no demo site (`staging.worshipcommons.org` still calls the retired staging Api), so nothing runs it after a deploy. Smoke never runs against production: `playwright.smoke.config.ts` refuses any host that is not a demo or local host. It opens the home page, the library, a collection, the first song in the library, that song's writer and its print chart. Each check waits for the API request that loads the page's data (prerendered HTML alone does not prove the Api answered), and every check fails on an uncaught page error or a 5xx from our hosts. There is no login project: the catalog is public, and the specs that need a user rely on the local demo account.

**Affected** runs the specs for the areas your branch changed, from `tests/areas.json`, plus any spec you edited and `always` (home). A changed file in no area (`src/songs.ts`, `src/api.ts`, `Layout.tsx`, test helpers, ...) is treated as shared code and runs the whole suite. `yarn test:affected --list` shows the selection; anything after `--` goes to Playwright (`yarn test:affected -- --headed`). It needs the local stack like `yarn test` (core Api checkout, reseeded demo data).

**Naming.** Name specs after the area and behavior (`upload-returned-draft.spec.ts`), not the issue number, and add new files to an area in `tests/areas.json`. `yarn test:areas` (also a PR check) fails if a spec is in no area.
