export type AgentId = 'manager' | 'clerk' | 'designer' | 'researcher' | 'tech';

export type AgentStatus =
  | 'idle'
  | 'receiving'
  | 'thinking'
  | 'sending'
  | 'reviewing'
  | 'reworking'
  | 'approved'
  | 'producing'
  | 'done'
  | 'rejected';

export type AgentState = {
  id: AgentId;
  name: string;
  role: string;
  prop: string;
  status: AgentStatus;
  bubbleText: string;
  bubbleVisible: boolean;
  approved?: boolean;
  rejectReason?: string;
  sceneAsset?: string;
  motionAssets?: Partial<Record<AgentStatus, string>>;
};

export type Envelope = {
  id: string;
  from: AgentId | 'output';
  to: AgentId | 'output';
  label: string;
  active: boolean;
};

export type HistoryItem = {
  icon: string;
  title: string;
  time: string;
  path?: string;
  subtitle?: string;
};

export type OutputFileItem = {
  label: string;
  path?: string;
  size?: number;
};

export type OutputItem = {
  title: string;
  folderPath: string;
  readyAt: string;
  files: OutputFileItem[];
  previewText?: string;
};
