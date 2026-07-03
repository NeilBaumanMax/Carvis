import type { AgentRole } from "../../shared/types/agent.js";

export type ProviderKind = "deepseek-claudecode" | "deepseek-openai" | "qwen-openai";

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
    provider: "deepseek-claudecode",
    modelEnvKey: "CARVIS_DEEPSEEK_WRITER_MODEL",
    defaultModel: "deepseek-v4-pro[1m]",
  },
  artist: {
    role: "artist",
    provider: "qwen-openai",
    modelEnvKey: "QWEN_OMNI_MODEL",
    defaultModel: "qwen3.5-omni-plus",
  },
  researcher: {
    role: "researcher",
    provider: "deepseek-openai",
    modelEnvKey: "CARVIS_DEEPSEEK_RESEARCHER_MODEL",
    defaultModel: "deepseek-chat",
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

  if (env.CARVIS_PROVIDER_MODE === "all-deepseek") {
    return {
      role,
      provider: "deepseek-claudecode",
      modelEnvKey:
        role === "engineer"
          ? "CARVIS_DEEPSEEK_ENGINEER_MODEL"
          : role === "writer"
            ? "CARVIS_DEEPSEEK_WRITER_MODEL"
            : "CARVIS_DEEPSEEK_MANAGER_MODEL",
      defaultModel:
        env[
          role === "engineer"
            ? "CARVIS_DEEPSEEK_ENGINEER_MODEL"
            : role === "writer"
              ? "CARVIS_DEEPSEEK_WRITER_MODEL"
              : "CARVIS_DEEPSEEK_MANAGER_MODEL"
        ] ??
        "deepseek-v4-pro[1m]",
    };
  }

  return {
    ...config,
    defaultModel: env[config.modelEnvKey] ?? config.defaultModel,
  };
}
