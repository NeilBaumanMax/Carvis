import type { AgentRole } from "../../shared/types/agent.js";

export type ProviderKind = "deepseek-claudecode" | "qwen-openai";

export interface RoleProviderConfig {
  role: AgentRole;
  provider: ProviderKind;
  modelEnvKey: string;
  defaultModel: string;
}

export const ROLE_PROVIDER_CONFIG: Record<AgentRole, RoleProviderConfig> = {
  manager: {
    role: "manager",
    provider: "deepseek-claudecode",
    modelEnvKey: "CARVIS_DEEPSEEK_MANAGER_MODEL",
    defaultModel: "deepseek-v4-pro[1m]",
  },
  writer: {
    role: "writer",
    provider: "qwen-openai",
    modelEnvKey: "QWEN_OMNI_MODEL",
    defaultModel: "qwen3.5-omni-plus",
  },
  artist: {
    role: "artist",
    provider: "qwen-openai",
    modelEnvKey: "QWEN_OMNI_MODEL",
    defaultModel: "qwen3.5-omni-plus",
  },
  researcher: {
    role: "researcher",
    provider: "qwen-openai",
    modelEnvKey: "QWEN_OMNI_MODEL",
    defaultModel: "qwen3.5-omni-plus",
  },
  engineer: {
    role: "engineer",
    provider: "deepseek-claudecode",
    modelEnvKey: "CARVIS_DEEPSEEK_ENGINEER_MODEL",
    defaultModel: "deepseek-v4-pro[1m]",
  },
};

export function getRoleProviderConfig(role: AgentRole, env: NodeJS.ProcessEnv = process.env): RoleProviderConfig {
  const config = ROLE_PROVIDER_CONFIG[role];

  return {
    ...config,
    defaultModel: env[config.modelEnvKey] ?? config.defaultModel,
  };
}
