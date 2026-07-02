import { join } from "node:path";

import { createRemoteMessageBus } from "../messagebus/index.js";
import { writeOutput } from "../output/index.js";
import { runComponentMain } from "../shared/componentMain.js";
import { createAgentRuntime } from "./index.js";
import {
  initializeWorkplaces,
  readWorkplaceResults,
  writeWorkplaceResult,
} from "./workplaces/index.js";

const bus = createRemoteMessageBus({
  port: readPort(process.env.CARVIS_MESSAGEBUS_PORT),
});
const workplacesRoot = process.env.CARVIS_WORKPLACES_ROOT ?? join(process.cwd(), "workplaces", "live");
const outputRoot = process.env.CARVIS_OUTPUT_ROOT ?? "output";
const initializedRuns = new Set<string>();
const runtime = createAgentRuntime(bus, {
  roleRunner: async ({ run, agent, commandText }) => {
    if (!initializedRuns.has(run.runId)) {
      await initializeWorkplaces(workplacesRoot, commandText);
      initializedRuns.add(run.runId);
    }

    await writeWorkplaceResult(workplacesRoot, agent.role, renderRoleResult(agent.role, commandText));
  },
  outputWriter: async () => {
    const results = await readWorkplaceResults(workplacesRoot);

    return writeOutput({
      outputRootPath: outputRoot,
      title: "Carvis Live Task Output",
      workplaceResults: results.map((result) => ({
        role: result.role,
        sourcePath: result.resultPath,
        content: result.result,
      })),
    });
  },
});

await runComponentMain({
  name: "agentruntime",
  onStart: () => {
    runtime.start();
    console.log("[agentruntime] connected to messagebus");
  },
  onShutdown: async () => {
    await runtime.shutdown();
    bus.close();
  },
});

function readPort(value: string | undefined): number {
  if (value === undefined) {
    return 45931;
  }

  const port = Number.parseInt(value, 10);

  if (!Number.isFinite(port) || port <= 0) {
    return 45931;
  }

  return port;
}

function renderRoleResult(role: string, commandText: string): string {
  switch (role) {
    case "manager":
      return [
        "## Manager Plan",
        "",
        `Task: ${commandText}`,
        "",
        "- Scope the game as an original literary dark-fantasy RPG about memory, aging, buried history, and reconciliation.",
        "- Avoid using protected plot, characters, locations, or unique expressions from the source novel.",
        "- Deliver a playable MVP around one village hub, one misted road, one ruin, and a final memory trial.",
      ].join("\n");
    case "writer":
      return [
        "## Writer Narrative",
        "",
        "Working title: Veil of Ash and Heather.",
        "",
        "The player guides two aging wanderers through a valley where a pale mist softens personal memory and public guilt. Villagers prefer peace bought by forgetting, while old songs, scars, and ruined stones insist that something terrible was buried rather than healed.",
        "",
        "The story should center on choices: recover memories and risk renewed hatred, or preserve forgetting and lose identity. The final act asks whether truth must be carried as judgment, mourning, or a promise to rebuild.",
      ].join("\n");
    case "artist":
      return [
        "## Artist Direction",
        "",
        "- Visual tone: muted greens, wet stone, ash-gray skies, warm lantern interiors.",
        "- Characters: weathered travelers, guarded villagers, silent memorial keepers, masked oath-breakers.",
        "- UI motif: a fraying tapestry map where restored memories stitch new threads into old blank spaces.",
        "- Key scenes: fog road, abandoned causeway, giant barrow-like hill, ruined watchtower, twilight river crossing.",
      ].join("\n");
    case "researcher":
      return [
        "## Researcher Systems",
        "",
        "- Memory meter: remembering unlocks truth, dialogue, and hidden paths; forgetting lowers conflict and avoids some fights.",
        "- Bond meter: companions can disagree about whether a memory should be restored.",
        "- Exploration loop: talk, inspect relics, solve memory echoes, choose what to record in the party journal.",
        "- Combat loop: low-frequency tactical encounters against grief-forms, oath-shades, and fear-born guardians.",
      ].join("\n");
    case "engineer":
      return [
        "## Engineer MVP Build List",
        "",
        "1. Hub village with 6 NPCs, dialogue flags, and one memory choice.",
        "2. Misted road exploration map with three relic interactions.",
        "3. Turn-based combat prototype: two party members, three enemy types, guard/appeal/strike actions.",
        "4. Memory journal UI that stores recovered, refused, and distorted memories.",
        "5. Three chapter quests:",
        "   - The Empty Feast: restore or suppress a village betrayal memory.",
        "   - Stones Under Moss: uncover why a road was abandoned.",
        "   - The Hill That Breathes: decide what truth reaches the valley.",
        "6. Endings:",
        "   - Mercy of Mist: peace remains, identity fades.",
        "   - Burden of Names: truth returns, conflict resumes, repair begins.",
        "   - Shared Vigil: partial truth becomes ritual mourning instead of revenge.",
      ].join("\n");
    default:
      return `Completed ${role}: ${commandText}`;
  }
}
