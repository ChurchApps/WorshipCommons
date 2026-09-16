// yarn demo — reseed the local commons DB + content from WorshipCommonsContent, same reset Playwright's global-setup runs.
// Requires the core Api's .env (COMMONS_CONNECTION_STRING to a local MySQL) and a WorshipCommonsContent checkout.
import { execSync } from "child_process";
import * as fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { coreApiDir } from "./core-api-dir.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const contentRepo = process.env.COMMONS_CONTENT_REPO || [path.resolve(here, "../../../WorshipCommonsContent"), path.resolve(here, "../../../../WorshipCommonsContent")].find((p) => fs.existsSync(path.join(p, "catalog.json")));
if (!contentRepo) throw new Error("Set COMMONS_CONTENT_REPO to a WorshipCommonsContent checkout (folder holding catalog.json).");

const apiDir = coreApiDir();
execSync("yarn reset-commons", { cwd: apiDir, stdio: "inherit", env: { ...process.env, COMMONS_CONTENT_REPO: contentRepo } });
console.log(`\nDemo data ready. Api: ${apiDir} (yarn dev → :8084)   Site: yarn dev → :3104   Login: demo@b1.church / password`);
