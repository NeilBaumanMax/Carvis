import { createInterface } from "node:readline";

const role = process.env.CARVIS_PID_AGENT_ROLE ?? "unknown";
const input = createInterface({
  input: process.stdin,
});

input.on("line", (line) => {
  const message = JSON.parse(line) as {
    taskId?: string;
    input?: string;
    shutdown?: boolean;
  };

  if (message.shutdown === true) {
    process.exit(0);
  }

  if (message.taskId === undefined) {
    return;
  }

  process.stdout.write(
    `${JSON.stringify({
      taskId: message.taskId,
      output: `${role}:${message.input ?? ""}`,
    })}\n`,
  );
  process.stdout.write(
    `${JSON.stringify({
      taskId: message.taskId,
      done: true,
    })}\n`,
  );
});
