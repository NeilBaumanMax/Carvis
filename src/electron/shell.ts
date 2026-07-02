import { readFile } from "node:fs/promises";
import { dirname } from "node:path";

import type {
  AgentLifecyclePayload,
  AgentOutputPayload,
  CommandSubmittedPayload,
  OutputReadyPayload,
  RuntimeHeartbeatPayload,
} from "../shared/types/events.js";
import type { AgentRole } from "../shared/types/agent.js";
import type { MessageBus, MessageBusSubscription } from "../messagebus/index.js";
import type {
  ElectronOutputEntry,
  ElectronRuntimeDisplayState,
  ElectronShellState,
  ElectronShellStateSubscription,
  ElectronSubmitCommandOptions,
  ElectronWorkplacePanel,
} from "./types.js";

const PANEL_ROLES: AgentRole[] = ["manager", "writer", "artist", "researcher", "engineer"];

export class ElectronShell {
  private readonly subscriptions: MessageBusSubscription[] = [];
  private readonly stateHandlers = new Set<(state: ElectronShellState) => void>();
  private readonly state: ElectronShellState;

  constructor(private readonly bus: MessageBus) {
    this.state = {
      panels: createDefaultPanels(),
      runtime: createEmptyRuntimeState(),
      outputs: [],
      submittedCommands: [],
      recentEvents: [],
    };

    this.subscribeToRuntimeEvents();
  }

  async submitCommand(
    commandText: string,
    options: ElectronSubmitCommandOptions = {},
  ): Promise<void> {
    const normalizedCommand = commandText.trim();

    if (normalizedCommand.length === 0) {
      return;
    }

    await this.bus.publish<CommandSubmittedPayload>({
      type: "command.submitted",
      source: "electron",
      target: "agentruntime",
      requestId: options.requestId,
      payload: {
        commandText: normalizedCommand,
      },
    });

    this.state.submittedCommands.push(normalizedCommand);
    this.rememberEvent(`command.submitted:${normalizedCommand}`);
  }

  getState(): ElectronShellState {
    return cloneState(this.state);
  }

  onStateChanged(handler: (state: ElectronShellState) => void): ElectronShellStateSubscription {
    this.stateHandlers.add(handler);

    return {
      unsubscribe: () => {
        this.stateHandlers.delete(handler);
      },
    };
  }

  dispose(): void {
    for (const subscription of this.subscriptions.splice(0)) {
      subscription.unsubscribe();
    }
    this.stateHandlers.clear();
  }

  private subscribeToRuntimeEvents(): void {
    this.subscriptions.push(
      this.bus.subscribe<RuntimeHeartbeatPayload>(
        {
          type: "runtime.heartbeat",
          target: "electron",
        },
        (event) => {
          this.state.runtime = {
            ...event.payload,
            lastHeartbeatAt: event.timestamp,
          };
          this.rememberEvent("runtime.heartbeat");
        },
      ),
    );

    this.subscriptions.push(
      this.bus.subscribe<OutputReadyPayload>(
        {
          type: "output.ready",
          target: "electron",
        },
        async (event) => {
          this.state.outputs.push(await createOutputEntry(event.payload, event.timestamp));
          this.rememberEvent(`output.ready:${event.payload.outputPath}`);
        },
      ),
    );

    this.subscriptions.push(
      this.bus.subscribe<AgentOutputPayload>(
        {
          type: "agent.output",
          target: "electron",
        },
        (event) => {
          const panel = this.findPanelByAgentId(event.agentId);

          if (panel === undefined) {
            this.rememberEvent("agent.output:unmatched");
            return;
          }

          panel.latestOutput = appendPanelOutput(panel.latestOutput, event.payload.text);
          panel.lastHeartbeatAt = event.timestamp;
          this.rememberEvent(`agent.output:${panel.role}`);
        },
      ),
    );

    for (const type of ["agent.starting", "agent.ready", "agent.done", "agent.retained", "agent.shutdown"] as const) {
      this.subscriptions.push(
        this.bus.subscribe<AgentLifecyclePayload>(
          {
            type,
            target: "electron",
          },
          (event) => {
            const panel = this.findPanelByAgentId(event.agentId);

            if (panel === undefined) {
              this.rememberEvent(`${type}:unmatched`);
              return;
            }

            panel.status = event.payload.status;
            panel.pid = event.payload.pid;
            panel.workplacePath = event.payload.workplacePath;
            panel.lastHeartbeatAt = event.timestamp;
            this.rememberEvent(`${type}:${panel.role}`);
          },
        ),
      );
    }
  }

  private findPanelByAgentId(agentId: string | undefined): ElectronWorkplacePanel | undefined {
    if (agentId === undefined) {
      return undefined;
    }

    return this.state.panels.find((panel) => panel.role === agentId);
  }

  private rememberEvent(eventSummary: string): void {
    this.state.recentEvents.unshift(eventSummary);
    this.state.recentEvents.splice(10);
    this.emitStateChanged();
  }

  private emitStateChanged(): void {
    const state = this.getState();

    for (const handler of this.stateHandlers) {
      handler(state);
    }
  }
}

export function createElectronShell(bus: MessageBus): ElectronShell {
  return new ElectronShell(bus);
}

function createDefaultPanels(): ElectronWorkplacePanel[] {
  return PANEL_ROLES.map((role) => ({
    role,
    title: roleTitle(role),
    workplacePath: `workplaces/${role}`,
    status: "idle",
  }));
}

function createEmptyRuntimeState(): ElectronRuntimeDisplayState {
  return {
    activePidCount: 0,
    idlePidCount: 0,
    retainedPidCount: 0,
    queueDepth: 0,
  };
}

function roleTitle(role: AgentRole): string {
  switch (role) {
    case "manager":
      return "Manager";
    case "writer":
      return "Writer";
    case "artist":
      return "Artist";
    case "researcher":
      return "Researcher";
    case "engineer":
      return "Engineer";
  }
}

function appendPanelOutput(existing: string | undefined, text: string): string {
  const next = existing === undefined || existing.length === 0 ? text : `${existing}\n${text}`;
  const lines = next.split("\n");

  return lines.slice(-80).join("\n");
}

async function createOutputEntry(
  payload: OutputReadyPayload,
  readyAt: string,
): Promise<ElectronOutputEntry> {
  const outputFolderPath = dirname(payload.outputPath);
  const manifest = await readOutputManifestPreview(payload.manifestPath);
  const previewText = await readFinalReportPreview(payload.outputPath);

  return {
    ...payload,
    outputFolderPath,
    previewText,
    manifestEntries: manifest.entries,
    previewStatus: previewText === undefined ? "preview unavailable" : "preview ready",
    readyAt,
  };
}

async function readFinalReportPreview(outputPath: string): Promise<string | undefined> {
  try {
    const report = await readFile(outputPath, "utf8");

    return report.length > 3_600 ? `${report.slice(0, 3_600).trimEnd()}\n\n...` : report;
  } catch {
    return undefined;
  }
}

async function readOutputManifestPreview(
  manifestPath: string | undefined,
): Promise<{ entries: ElectronOutputEntry["manifestEntries"] }> {
  if (manifestPath === undefined) {
    return { entries: [] };
  }

  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      entries?: ElectronOutputEntry["manifestEntries"];
    };

    return {
      entries: Array.isArray(manifest.entries) ? manifest.entries : [],
    };
  } catch {
    return { entries: [] };
  }
}

function cloneState(state: ElectronShellState): ElectronShellState {
  return {
    panels: state.panels.map((panel) => ({ ...panel })),
    runtime: { ...state.runtime },
    outputs: state.outputs.map((output) => ({
      ...output,
      manifestEntries: output.manifestEntries.map((entry) => ({ ...entry })),
    })),
    submittedCommands: [...state.submittedCommands],
    recentEvents: [...state.recentEvents],
  };
}
