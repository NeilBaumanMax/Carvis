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
  gamePreviewTitle?: string;
  gamePreviewBytes?: number;
  finalReportBytes?: number;
  manifestBytes?: number;
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
  remoteDraft?: ElectronRemoteDraft;
  remoteAccess?: ElectronRemoteAccess;
}

export interface ElectronSubmitCommandOptions {
  requestId?: string;
}

export interface ElectronRemoteDraft {
  text: string;
  updatedAt: string;
  source: "electron" | "nas" | "api";
}

export interface ElectronRemoteAccess {
  ip: string;
  electronApiUrl: string;
  phoneUrl: string;
}

export interface ElectronShellStateSubscription {
  unsubscribe(): void;
}
