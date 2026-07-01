import type { AgentRole } from "../../shared/types/agent.js";
import type { RuntimeRoleRunner } from "../types.js";
import { writeWorkplaceResult } from "../workplaces/index.js";
import { ClaudeCodeWarmSdkAgent } from "./warmSdk.js";

export interface ClaudeCodeWarmSdkRoleRunnerOptions {
  env?: NodeJS.ProcessEnv;
  workplacesRoot: string;
  cwd?: string;
  model?: string;
  maxBudgetUsd?: string;
  timeoutMs?: number;
  promptForRole?: (role: string) => string;
  validateOutput?: (role: string, output: string) => void;
}

export interface ClaudeCodeWarmSdkRoleRunner {
  runner: RuntimeRoleRunner;
  shutdown(): void;
}

export function createClaudeCodeWarmSdkRoleRunner(
  options: ClaudeCodeWarmSdkRoleRunnerOptions,
): ClaudeCodeWarmSdkRoleRunner {
  const env = options.env ?? process.env;
  const agents = new Map<AgentRole, ClaudeCodeWarmSdkAgent>();

  const runner: RuntimeRoleRunner = async ({ agent }) => {
    const sdkAgent = getAgent(agent.role);
    const prompt = options.promptForRole?.(agent.role) ?? defaultRolePrompt(agent.role);
    const result = await sdkAgent.query(prompt);
    const output = result.output.trim();

    if (result.spawn?.pid !== undefined) {
      agent.pid = result.spawn.pid;
    }

    options.validateOutput?.(agent.role, output);
    await writeWorkplaceResult(options.workplacesRoot, agent.role, output);
  };

  return {
    runner,
    shutdown: () => {
      for (const sdkAgent of agents.values()) {
        sdkAgent.close();
      }
      agents.clear();
    },
  };

  function getAgent(role: AgentRole): ClaudeCodeWarmSdkAgent {
    const existing = agents.get(role);

    if (existing !== undefined) {
      return existing;
    }

    const sdkAgent = new ClaudeCodeWarmSdkAgent({
      env,
      cwd: options.cwd,
      model: options.model ?? env.CARVIS_REAL_MVP_MODEL ?? "deepseek-v4-flash",
      maxBudgetUsd: options.maxBudgetUsd ?? env.CARVIS_REAL_MVP_MAX_BUDGET_USD ?? "0.20",
      timeoutMs: options.timeoutMs ?? Number(env.CARVIS_REAL_MVP_TIMEOUT_MS ?? 180_000),
    });

    agents.set(role, sdkAgent);
    return sdkAgent;
  }
}

function defaultRolePrompt(role: string): string {
  return `Reply exactly: ${role} real claude smoke ok`;
}
