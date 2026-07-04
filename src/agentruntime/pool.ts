import { randomUUID } from "node:crypto";

import type { AgentRole, AgentRuntimeState, AgentStatus } from "../shared/types/agent.js";
import type { PoolSnapshot, RuntimeConfig } from "./types.js";
import { isValidStatusTransition, roleTitle } from "./types.js";

export interface AgentPool {
  getAgent(role: AgentRole): AgentRuntimeState | undefined;
  createAgent(role: AgentRole): AgentRuntimeState;
  transitionAgent(agentId: string, status: AgentStatus): AgentRuntimeState;
  getSnapshot(): PoolSnapshot;
  shutdownAll(): AgentRuntimeState[];
  get queueDepth(): number;
  set queueDepth(value: number);
}

export function createAgentPool(config: RuntimeConfig): AgentPool {
  const agents = new Map<string, AgentRuntimeState>();
  let _queueDepth = 0;

  return {
    getAgent(role) {
      return [...agents.values()].find((a) => a.role === role);
    },

    createAgent(role) {
      const agentId = `agent-${role}-${randomUUID().slice(0, 8)}`;
      const agent: AgentRuntimeState = {
        agentId,
        role,
        workplacePath: `${config.workplaceRoot}/${role}`,
        status: "idle",
      };
      agents.set(agentId, agent);
      return agent;
    },

    transitionAgent(agentId, status) {
      const agent = agents.get(agentId);
      if (agent === undefined) {
        throw new Error(`agent not found: ${agentId}`);
      }

      if (!isValidStatusTransition(agent.status, status)) {
        throw new Error(
          `invalid agent status transition: ${agent.role} ${agent.status} -> ${status}`,
        );
      }

      agent.status = status;
      agent.lastHeartbeatAt = new Date().toISOString();

      if (status === "shutdown") {
        agent.pid = undefined;
      }

      return agent;
    },

    getSnapshot() {
      const agentList = [...agents.values()];
      const active = agentList.filter((a) => a.status === "working").length;
      const idle = agentList.filter((a) => a.status === "idle" || a.status === "ready").length;
      const retained = agentList.filter((a) => a.status === "retained" || a.status === "done").length;

      return {
        activePidCount: active,
        idlePidCount: idle,
        retainedPidCount: retained,
        queueDepth: _queueDepth,
        agents: agentList.map((a) => ({ ...a })),
      };
    },

    shutdownAll() {
      const results: AgentRuntimeState[] = [];
      for (const agent of agents.values()) {
        if (agent.status !== "shutdown" && agent.status !== "failed") {
          agent.status = "shutdown";
          agent.lastHeartbeatAt = new Date().toISOString();
        }
        results.push({ ...agent });
      }
      return results;
    },

    get queueDepth() {
      return _queueDepth;
    },

    set queueDepth(value) {
      _queueDepth = value;
    },
  };
}
