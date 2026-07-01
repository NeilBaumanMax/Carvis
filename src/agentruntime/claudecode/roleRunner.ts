import type { RuntimeRoleRunner } from "../types.js";
import { writeWorkplaceResult } from "../workplaces/index.js";
import { runClaudeCodePrint } from "./command.js";

export interface ClaudeCodeRoleRunnerOptions {
  env?: NodeJS.ProcessEnv;
  workplacesRoot: string;
  cwd?: string;
  model?: string;
  maxBudgetUsd?: string;
  timeoutMs?: number;
  promptForRole?: (role: string) => string;
  validateOutput?: (role: string, output: string) => void;
}

export function createClaudeCodeRoleRunner(options: ClaudeCodeRoleRunnerOptions): RuntimeRoleRunner {
  const env = options.env ?? process.env;

  return async ({ agent }) => {
    const prompt = options.promptForRole?.(agent.role) ?? defaultRolePrompt(agent.role);
    const result = await runClaudeCodePrint(prompt, {
      env,
      model: options.model ?? env.CARVIS_REAL_MVP_MODEL ?? "deepseek-v4-flash",
      maxBudgetUsd: options.maxBudgetUsd ?? env.CARVIS_REAL_MVP_MAX_BUDGET_USD ?? "0.20",
      timeoutMs: options.timeoutMs ?? Number(env.CARVIS_REAL_MVP_TIMEOUT_MS ?? 180_000),
      cwd: options.cwd,
    });
    const output = result.stdout.trim();

    if (result.exitCode !== 0) {
      throw new Error(
        `${agent.role} claude exited with ${String(result.exitCode)} stdout=${output} stderr=${result.stderr.trim()}`,
      );
    }

    options.validateOutput?.(agent.role, output);
    await writeWorkplaceResult(options.workplacesRoot, agent.role, output);
  };
}

function defaultRolePrompt(role: string): string {
  return `Reply exactly: ${role} real claude smoke ok`;
}
