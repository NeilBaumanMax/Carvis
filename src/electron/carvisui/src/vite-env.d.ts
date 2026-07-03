/// <reference types="vite/client" />

type CarvisAgentRole = 'manager' | 'writer' | 'artist' | 'researcher' | 'engineer';
type CarvisAgentStatus =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'assigned'
  | 'working'
  | 'waiting'
  | 'done'
  | 'retained'
  | 'failed'
  | 'shutdown';

type CarvisPanel = {
  role: CarvisAgentRole;
  title: string;
  workplacePath: string;
  status: CarvisAgentStatus;
  pid?: number;
  lastHeartbeatAt?: string;
  latestOutput?: string;
};

type CarvisOutputEntry = {
  outputPath: string;
  outputFolderPath: string;
  manifestPath?: string;
  gamePreviewPath?: string;
  gamePreviewTitle?: string;
  gamePreviewBytes?: number;
  finalReportBytes?: number;
  manifestBytes?: number;
  previewText?: string;
  previewStatus: string;
  readyAt: string;
};

type CarvisRemoteDraft = {
  text: string;
  updatedAt: string;
  source: 'electron' | 'nas' | 'api';
};

type CarvisRemoteAccess = {
  ip: string;
  electronApiUrl: string;
  phoneUrl: string;
};

type CarvisShellState = {
  panels: CarvisPanel[];
  runtime: {
    activePidCount: number;
    idlePidCount: number;
    retainedPidCount: number;
    queueDepth: number;
    lastHeartbeatAt?: string;
  };
  outputs: CarvisOutputEntry[];
  submittedCommands: string[];
  recentEvents: string[];
  remoteDraft?: CarvisRemoteDraft;
  remoteAccess?: CarvisRemoteAccess;
};

type CarvisBridge = {
  getState: () => Promise<CarvisShellState>;
  submitCommand: (commandText: string) => Promise<void>;
  openOutput: (outputPath: string) => Promise<string>;
  onState: (listener: (state: CarvisShellState) => void) => () => void;
};

interface Window {
  carvis?: CarvisBridge;
}
