import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface, type Interface } from "node:readline";

import type { AgentRole } from "../../shared/types/agent.js";

export interface PersistentPidAgentCommand {
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

export interface PersistentPidAgentTask {
  input: string;
  timeoutMs?: number;
  onOutput?: (output: string) => void;
}

export interface PersistentPidAgentTaskResult {
  pid: number;
  output: string;
  metadata?: unknown;
}

export interface PersistentPidAgent {
  readonly role: AgentRole;
  readonly pid: number;
  readonly retained: boolean;
  runTask(task: PersistentPidAgentTask): Promise<PersistentPidAgentTaskResult>;
  shutdown(): Promise<void>;
}

export interface PersistentPidAgentPoolOptions {
  createCommand(role: AgentRole): PersistentPidAgentCommand;
  agentKey?: (role: AgentRole) => string;
}

export class PersistentPidAgentPool {
  private readonly agents = new Map<string, LineProtocolPidAgent>();

  constructor(private readonly options: PersistentPidAgentPoolOptions) {}

  getAgent(role: AgentRole): PersistentPidAgent {
    const key = this.options.agentKey?.(role) ?? role;
    const existing = this.agents.get(key);

    if (existing !== undefined && !existing.isClosed) {
      return existing;
    }

    const command = this.options.createCommand(role);
    const agent = new LineProtocolPidAgent(role, command);

    this.agents.set(key, agent);
    return agent;
  }

  getAgents(): PersistentPidAgent[] {
    return [...this.agents.values()];
  }

  prewarm(roles: AgentRole[]): PersistentPidAgent[] {
    return roles.map((role) => this.getAgent(role));
  }

  async shutdown(): Promise<void> {
    await Promise.all([...this.agents.values()].map((agent) => agent.shutdown()));
    this.agents.clear();
  }
}

class LineProtocolPidAgent implements PersistentPidAgent {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly stdout: Interface;
  private readonly pending = new Map<
    string,
    {
      output: string[];
      metadata?: unknown;
      resolve: (output: string) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
      onOutput?: (output: string) => void;
    }
  >();
  private closed = false;
  retained = false;

  get isClosed(): boolean {
    return this.closed;
  }

  constructor(
    readonly role: AgentRole,
    command: PersistentPidAgentCommand,
  ) {
    this.child = spawn(command.command, command.args, {
      cwd: command.cwd,
      env: {
        ...process.env,
        ...command.env,
        CARVIS_PID_AGENT_ROLE: role,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.stdout = createInterface({
      input: this.child.stdout,
    });

    this.stdout.on("line", (line) => {
      this.handleLine(line);
    });
    this.child.once("exit", (code, signal) => {
      this.closed = true;
      const error = new Error(`pid agent ${this.role} exited code=${String(code)} signal=${String(signal)}`);

      for (const [taskId, pending] of this.pending) {
        clearTimeout(pending.timeout);
        this.pending.delete(taskId);
        pending.reject(error);
      }
    });
    this.child.stderr.on("data", () => {
      // stderr is intentionally consumed so the child cannot block.
    });
    this.child.stdin.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code !== "EPIPE") {
        throw error;
      }
    });
  }

  get pid(): number {
    return this.child.pid ?? -1;
  }

  async runTask(task: PersistentPidAgentTask): Promise<PersistentPidAgentTaskResult> {
    if (this.closed) {
      throw new Error(`pid agent ${this.role} is closed`);
    }

    const taskId = randomUUID();
    const output = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(taskId);
        this.closed = true;
        this.kill("SIGTERM");
        setTimeout(() => {
          this.kill("SIGKILL");
        }, 2_000).unref();
        reject(new Error(`pid agent ${this.role} task timed out after ${task.timeoutMs ?? 10_000}ms`));
      }, task.timeoutMs ?? 10_000);

      this.pending.set(taskId, {
        output: [],
        resolve,
        reject,
        timeout,
        onOutput: task.onOutput,
      });
      this.child.stdin.write(`${JSON.stringify({ taskId, input: task.input })}\n`);
    });

    this.retained = true;
    return {
      pid: this.pid,
      output,
      metadata: this.lastMetadata,
    };
  }

  shutdown(): Promise<void> {
    if (this.closed) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.child.once("exit", () => {
        resolve();
      });
      if (!this.child.stdin.destroyed) {
        this.child.stdin.write(`${JSON.stringify({ shutdown: true })}\n`, (error) => {
          if (error !== null && (error as NodeJS.ErrnoException).code !== "EPIPE") {
            throw error;
          }
        });
      }
      setTimeout(() => {
        if (!this.closed) {
          this.kill("SIGTERM");
        }
      }, 1_000).unref();
    });
  }

  private kill(signal: NodeJS.Signals): void {
    try {
      this.child.kill(signal);
    } catch {
      // Best effort during shutdown/timeout.
    }
  }

  private handleLine(line: string): void {
    if (line.trim().length === 0) {
      return;
    }

    const message = JSON.parse(line) as {
      taskId?: string;
      output?: string;
      metadata?: unknown;
      done?: boolean;
    };

    if (message.taskId === undefined) {
      return;
    }

    const pending = this.pending.get(message.taskId);

    if (pending === undefined) {
      return;
    }

    if (message.output !== undefined) {
      pending.output.push(message.output);
      pending.onOutput?.(message.output);
    }

    if (message.metadata !== undefined) {
      pending.metadata = message.metadata;
    }

    if (message.done === true) {
      clearTimeout(pending.timeout);
      this.pending.delete(message.taskId);
      this.lastMetadata = pending.metadata;
      pending.resolve(pending.output.join("\n"));
    }
  }

  private lastMetadata: unknown;
}
