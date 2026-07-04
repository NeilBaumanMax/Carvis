export async function waitForShutdown(processName: string): Promise<void> {
  const keepAlive = setInterval(() => {
    // Keeps the process alive until setup sends a shutdown signal.
  }, 60_000);

  await new Promise<void>((resolve) => {
    const shutdown = (signal: NodeJS.Signals): void => {
      clearInterval(keepAlive);
      process.off("SIGINT", onSigint);
      process.off("SIGTERM", onSigterm);
      console.log(`[${processName}] shutdown requested by ${signal}`);
      resolve();
    };

    const onSigint = (): void => shutdown("SIGINT");
    const onSigterm = (): void => shutdown("SIGTERM");

    process.once("SIGINT", onSigint);
    process.once("SIGTERM", onSigterm);
  });
}

export function readPositiveIntEnv(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const value = env[name];

  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}
