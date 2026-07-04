import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createWorkplaces, WORKPLACE_ROLES } from "./index.js";

const rootDir = await mkdtemp(join(tmpdir(), "carvis-workplaces-"));
const workplaces = createWorkplaces({ rootDir });

try {
  await workplaces.ensure();
  await workplaces.writeTaskFile("writer", "writer task");
  await workplaces.writeRoleOutput("writer", "writer result");

  const output = await workplaces.readRoleOutput("writer");

  assert(output === "writer result", "workplaces should read back role output");
  assert(
    WORKPLACE_ROLES.every((role) => workplaces.getRolePath(role).startsWith(rootDir)),
    "all role paths should stay inside workspace root",
  );

  console.log("[workplaces:smoke] ok");
} finally {
  await rm(rootDir, { recursive: true, force: true });
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
