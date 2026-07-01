import type {
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
  ElectronSubmitCommandOptions,
  ElectronWorkplacePanel,
} from "./types.js";

const PANEL_ROLES: AgentRole[] = ["manager", "writer", "artist", "researcher", "engineer"];

export class ElectronShell {
  private readonly subscriptions: MessageBusSubscription[] = [];
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

  dispose(): void {
    for (const subscription of this.subscriptions.splice(0)) {
      subscription.unsubscribe();
    }
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
        (event) => {
          this.state.outputs.push({
            ...event.payload,
            readyAt: event.timestamp,
          });
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

          panel.latestOutput = event.payload.text;
          panel.lastHeartbeatAt = event.timestamp;
          this.rememberEvent(`agent.output:${panel.role}`);
        },
      ),
    );
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

function cloneState(state: ElectronShellState): ElectronShellState {
  return {
    panels: state.panels.map((panel) => ({ ...panel })),
    runtime: { ...state.runtime },
    outputs: state.outputs.map((output) => ({ ...output })),
    submittedCommands: [...state.submittedCommands],
    recentEvents: [...state.recentEvents],
  };
}
