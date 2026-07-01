import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  initializeWorkplaces,
  readWorkplaceResults,
  writeWorkplaceResult,
  WORKPLACE_ROLES,
} from "./index.js";

const rootPath = await mkdtemp(join(tmpdir(), "carvis-workplaces-"));

try {
  await initializeWorkplaces(rootPath, "build a workplace smoke");

  for (const role of WORKPLACE_ROLES) {
    await writeWorkplaceResult(rootPath, role, `${role} smoke result`);
  }

  const results = await readWorkplaceResults(rootPath);

  assert(results.length === WORKPLACE_ROLES.length, "should read all workplace results");
  assert(
    results.every((result) => result.result.includes(`${result.role} smoke result`)),
    "each workplace should keep its own result",
  );

  console.log("[workplaces:smoke] ok");
} finally {
  await rm(rootPath, { recursive: true, force: true });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
