import type { AgentRole, AgentStatus } from "../shared/types/agent.js";

export type ElectronPanelRole = AgentRole;

export interface ElectronWorkplacePanel {
  role: ElectronPanelRole;
  title: string;
  workplacePath: string;
  status: AgentStatus;
  pid?: number;
  lastHeartbeatAt?: string;
  latestOutput?: string;
}

export interface ElectronRuntimeDisplayState {
  activePidCount: number;
  idlePidCount: number;
  retainedPidCount: number;
  queueDepth: number;
  lastHeartbeatAt?: string;
}

export interface ElectronOutputEntry {
  outputPath: string;
  manifestPath?: string;
  readyAt: string;
}

export interface ElectronShellState {
  panels: ElectronWorkplacePanel[];
  runtime: ElectronRuntimeDisplayState;
  outputs: ElectronOutputEntry[];
  submittedCommands: string[];
  recentEvents: string[];
}

export interface ElectronSubmitCommandOptions {
  requestId?: string;
}
