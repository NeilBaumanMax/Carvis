import type { AgentRole } from "../../shared/types/agent.js";
import type { RuntimeBusClient } from "../messagebus/client.js";
import type { SpawnConfig, ClaudeCodeProcess } from "./spawn.js";
import { spawnClaudeCode } from "./spawn.js";

export interface ClaudeCodeAgentConfig {
  role: AgentRole;
  agentId: string;
  runId?: string;
  spawnConfig: SpawnConfig;
  busClient: RuntimeBusClient;
}

export interface ClaudeCodeAgent {
  readonly agentId: string;
  readonly role: AgentRole;
  readonly pid: number | undefined;
  writeInput(text: string): void;
  closeStdin(): void;
  kill(signal?: NodeJS.Signals): boolean;
  waitForExit(): Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}

export function createClaudeCodeAgent(config: ClaudeCodeAgentConfig): ClaudeCodeAgent {
  const process: ClaudeCodeProcess = spawnClaudeCode(config.spawnConfig);

  // Route stdout to messagebus
  process.onStdoutLine((line) => {
    config.busClient.publishAgentOutput(config.agentId, line, "stdout").catch(() => {});
  });

  // Route stderr to messagebus
  process.onStderrLine((line) => {
    config.busClient.publishAgentOutput(config.agentId, line, "stderr").catch(() => {});
  });

  // Route exit to messagebus
  process.onExit((code) => {
    if (code === 0) {
      config.busClient.publishAgentEvent("agent.done", config.agentId, config.runId).catch(() => {});
    } else {
      config.busClient.publishAgentOutput(
        config.agentId,
        `process exited with code ${code}`,
        "system",
      ).catch(() => {});
      config.busClient.publishAgentEvent("agent.error", config.agentId, config.runId).catch(() => {});
    }
  });

  // Route error to messagebus
  process.onError((err) => {
    config.busClient.publishAgentOutput(config.agentId, `process error: ${err.message}`, "stderr").catch(() => {});
    config.busClient.publishAgentEvent("agent.error", config.agentId, config.runId).catch(() => {});
  });

  return {
    get agentId() {
      return config.agentId;
    },
    get role() {
      return config.role;
    },
    get pid() {
      return process.pid;
    },
    writeInput(text) {
      process.writeInput(text);
    },
    closeStdin() {
      process.closeStdin();
    },
    kill(signal) {
      return process.kill(signal);
    },
    waitForExit() {
      return new Promise((resolve) => {
        process.onExit((code, signal) => {
          resolve({ code, signal });
        });
      });
    },
  };
}

export interface RolePrompt {
  role: AgentRole;
  systemPrompt: string;
  userPrompt: string;
}

export function defaultRolePrompts(): Record<AgentRole, RolePrompt> {
  return {
    manager: {
      role: "manager",
      systemPrompt:
        "You are a project Manager agent. Plan and coordinate tasks. Break down complex requests into clear, actionable steps.",
      userPrompt: "Analyze the following task and create a plan:",
    },
    writer: {
      role: "writer",
      systemPrompt:
        "You are a Writer agent. Produce clear, well-structured documentation and content based on the plan provided.",
      userPrompt: "Write the content based on the following plan:",
    },
    artist: {
      role: "artist",
      systemPrompt:
        "You are an Artist agent. Create visual assets, design elements, and graphical content.",
      userPrompt: "Create visual assets based on the following specification:",
    },
    researcher: {
      role: "researcher",
      systemPrompt:
        "You are a Researcher agent. Research and gather information, analyze data, and provide insights.",
      userPrompt: "Research the following topic and provide findings:",
    },
    engineer: {
      role: "engineer",
      systemPrompt:
        "You are an Engineer agent. Build, integrate, and deliver the final product by combining outputs from all roles.",
      userPrompt: "Build the final product using all available outputs:",
    },
  };
}
