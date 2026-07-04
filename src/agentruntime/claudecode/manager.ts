import type { AgentRole } from "../../shared/types/agent.js";
import type { RuntimeBusClient } from "../messagebus/client.js";
import type { RuntimeConfig } from "../types.js";
import type { ClaudeCodeAgentConfig, ClaudeCodeAgent } from "./agent.js";
import { createClaudeCodeAgent } from "./agent.js";
import { resolveClaudePath } from "./spawn.js";

export interface AgentManager {
  startAgent(
    role: AgentRole,
    agentId: string,
    runId?: string,
    extraArgs?: string[],
  ): ClaudeCodeAgent;
  shutdownAll(): void;
  get activeAgents(): ReadonlyMap<string, ClaudeCodeAgent>;
}

export function createAgentManager(
  config: RuntimeConfig,
  busClient: RuntimeBusClient,
): AgentManager {
  const agents = new Map<string, ClaudeCodeAgent>();

  function buildSpawnConfig(
    role: AgentRole,
    agentId: string,
    runId?: string,
    extraArgs?: string[],
  ): ClaudeCodeAgentConfig {
    return {
      role,
      agentId,
      runId,
      spawnConfig: {
        command: resolveClaudePath(),
        args: ["-p", ...(extraArgs ?? [])],
        cwd: `${config.workplaceRoot}/${role}`,
        timeoutMs: config.shutdownTimeoutMs,
      },
      busClient,
    };
  }

  return {
    startAgent(role, agentId, runId, extraArgs) {
      const agentConfig = buildSpawnConfig(role, agentId, runId, extraArgs);
      const agent = createClaudeCodeAgent(agentConfig);
      agents.set(agentId, agent);
      return agent;
    },

    shutdownAll() {
      for (const [agentId, agent] of agents) {
        try {
          agent.kill("SIGTERM");
        } catch {
          // best-effort kill
        }
        agents.delete(agentId);
      }
    },

    get activeAgents() {
      return agents;
    },
  };
}
