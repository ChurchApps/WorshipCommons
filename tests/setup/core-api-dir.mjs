import * as fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** The core Api checkout that serves :8084 and owns `reset-commons`. ponytail: candidate list — set CORE_API_DIR for anything else. */
export function coreApiDir() {
  const candidates = [process.env.CORE_API_DIR, path.resolve(here, "../../../Api"), path.resolve(here, "../../../ChurchApps/Api"), path.resolve(here, "../../../../ChurchApps/Api")].filter(Boolean);
  const found = candidates.find((p) => fs.existsSync(path.join(p, "tools", "reset-commons.ts")));
  if (!found) throw new Error(`Could not find the core Api (tools/reset-commons.ts) in any of:\n  ${candidates.join("\n  ")}\nSet CORE_API_DIR.`);
  return found;
}
