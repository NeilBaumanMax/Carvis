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
  outputFolderPath: string;
  manifestPath?: string;
  gamePreviewPath?: string;
  previewText?: string;
  manifestEntries: ElectronOutputManifestEntry[];
  previewStatus: string;
  readyAt: string;
}

export interface ElectronOutputManifestEntry {
  role: AgentRole;
  sourcePath: string;
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

export interface ElectronShellStateSubscription {
  unsubscribe(): void;
}
