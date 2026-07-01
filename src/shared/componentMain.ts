export interface ComponentMainOptions {
  name: string;
  onStart?: () => void | Promise<void>;
  onShutdown?: () => void | Promise<void>;
}

export async function runComponentMain(options: ComponentMainOptions): Promise<void> {
  await options.onStart?.();
  console.log(`[${options.name}] started`);

  if (process.env.CARVIS_COMPONENT_ONCE === "1") {
    console.log(`[${options.name}] once mode finished`);
    return;
  }

  await waitForShutdown(options);
}

function waitForShutdown(options: ComponentMainOptions): Promise<void> {
  return new Promise((resolve) => {
    const heartbeat = setInterval(() => {
      console.log(`[${options.name}] heartbeat ${new Date().toISOString()}`);
    }, 30_000);

    const shutdown = (signal: NodeJS.Signals) => {
      clearInterval(heartbeat);
      console.log(`[${options.name}] shutdown by ${signal}`);
      void Promise.resolve(options.onShutdown?.()).finally(resolve);
    };

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
}
