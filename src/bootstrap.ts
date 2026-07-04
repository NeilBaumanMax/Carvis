import { createDeepSeekClaudeCodeEnv } from "./agentruntime/claudecode/deepseekClaudeCodeEnv.js";
import { loadSetupConfig, runSetupSupervisor, shutdownStartedProcesses } from "./setup/index.js";

export async function bootstrapCarvis(): Promise<void> {
  const claudeCodeEnv = createDeepSeekClaudeCodeEnv(process.env);
  const setupConfig = loadSetupConfig(process.env);
  const setupResult = await runSetupSupervisor(setupConfig);

  console.log("[carvis] TypeScript runtime bootstrap ready");
  console.log(`[carvis] Claude Code base URL: ${claudeCodeEnv.ANTHROPIC_BASE_URL}`);
  console.log(`[carvis] Primary model: ${claudeCodeEnv.ANTHROPIC_MODEL}`);
  console.log(`[carvis] Setup mode: ${setupConfig.mode}`);
  console.log(`[carvis] Setup startup order: ${setupResult.started.join(" -> ")}`);

  if (!setupResult.ok) {
    throw new Error(`setup failed at ${setupResult.failed}`);
  }

  if (setupConfig.mode === "spawn" && process.env.CARVIS_SETUP_HOLD_OPEN === "1") {
    console.log("[carvis] Full startup is running. Press Ctrl+C to stop.");
    await waitForSupervisorShutdown();
    await shutdownStartedProcesses(setupResult);
  }
}

async function waitForSupervisorShutdown(): Promise<void> {
  await new Promise<void>((resolve) => {
    const cleanup = (): void => {
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      resolve();
    };

    const onSignal = (): void => {
      cleanup();
    };

    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
  });
}
