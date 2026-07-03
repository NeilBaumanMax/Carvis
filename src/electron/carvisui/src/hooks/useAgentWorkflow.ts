import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initialAgents } from '../data/agents';
import type { AgentId, AgentState, AgentStatus, Envelope, HistoryItem, OutputItem, SpeedMode } from '../types';

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const uiToCarvisRole: Record<AgentId, CarvisAgentRole> = {
  manager: 'manager',
  clerk: 'writer',
  designer: 'artist',
  researcher: 'researcher',
  tech: 'engineer',
};

const carvisToUiRole: Record<CarvisAgentRole, AgentId> = {
  manager: 'manager',
  writer: 'clerk',
  artist: 'designer',
  researcher: 'researcher',
  engineer: 'tech',
};

const workerAgents: AgentId[] = ['clerk', 'designer', 'researcher'];
const bubbleIdleDelayMs = 20_000;

export function useAgentWorkflow() {
  const [agents, setAgents] = useState<Record<AgentId, AgentState>>(initialAgents);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [outputLogs, setOutputLogs] = useState<string[]>([]);
  const [shellState, setShellState] = useState<CarvisShellState | undefined>();
  const [running, setRunning] = useState(false);
  const previousOutputsCount = useRef(0);
  const previousSubmittedCount = useRef(0);
  const previousLatestOutput = useRef<Partial<Record<CarvisAgentRole, string>>>({});
  const animatedEvents = useRef(new Set<string>());
  const bubbleTimers = useRef<Partial<Record<AgentId, number>>>({});

  const setAgent = useCallback((id: AgentId, patch: Partial<AgentState>) => {
    setAgents((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }, []);

  const clearBubbleTimers = useCallback(() => {
    for (const timer of Object.values(bubbleTimers.current)) {
      if (timer !== undefined) window.clearTimeout(timer);
    }
    bubbleTimers.current = {};
  }, []);

  const resetAgents = useCallback(() => {
    setAgents(
      Object.fromEntries(
        Object.entries(initialAgents).map(([id, agent]) => [
          id,
          {
            ...agent,
            status: 'idle',
            bubbleText: '',
            bubbleVisible: false,
            approved: undefined,
            rejectReason: undefined,
          },
        ]),
      ) as Record<AgentId, AgentState>,
    );
    setEnvelopes([]);
    setOutputLogs([]);
    previousLatestOutput.current = {};
    animatedEvents.current.clear();
    clearBubbleTimers();
  }, [clearBubbleTimers]);

  const showBubble = useCallback(
    (id: AgentId, text: string, status: AgentStatus) => {
      if (bubbleTimers.current[id] !== undefined) {
        window.clearTimeout(bubbleTimers.current[id]);
      }

      setAgent(id, {
        status,
        bubbleText: text,
        bubbleVisible: true,
      });

      bubbleTimers.current[id] = window.setTimeout(() => {
        setAgent(id, {
          status: 'idle',
          bubbleVisible: false,
        });
        bubbleTimers.current[id] = undefined;
      }, bubbleIdleDelayMs);
    },
    [setAgent],
  );

  useEffect(() => () => clearBubbleTimers(), [clearBubbleTimers]);

  const appendLog = useCallback((line: string) => {
    setOutputLogs((logs) => [...logs.slice(-30), line]);
  }, []);

  const sendEnvelope = useCallback(
    async (from: AgentId, to: AgentId | 'output', label: string) => {
      const id = `${from}-${to}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setAgent(from, { status: 'sending' });
      if (to !== 'output') setAgent(to, { status: 'receiving' });
      setEnvelopes((current) => [...current, { id, from, to, label, active: true }]);
      await sleep(3600);
      setEnvelopes((current) => current.filter((envelope) => envelope.id !== id));
      if (to !== 'output') setAgent(to, { status: 'idle' });
    },
    [setAgent],
  );

  const bootstrapState = useCallback(async () => {
    const bridge = window.carvis;

    if (!bridge) {
      appendLog('[Electron] 未检测到 Carvis preload，当前只能显示静态 UI。');
      return;
    }

    const state = await bridge.getState();
    previousOutputsCount.current = state.outputs.length;
    previousSubmittedCount.current = state.submittedCommands.length;
    setShellState(state);
  }, [appendLog]);

  useEffect(() => {
    void bootstrapState();
    const unsubscribe = window.carvis?.onState((state) => {
      setShellState(state);
    });

    return () => unsubscribe?.();
  }, [bootstrapState]);

  const startVisualWorkflow = useCallback(
    async (task: string, submitToCarvis: boolean, speedMode: SpeedMode = 'auto') => {
      resetAgents();
      setRunning(true);
      appendLog(`[用户] 提交任务：${task}`);

      showBubble('manager', '收到任务，正在拆分给文员、设计、调研，并等待他们返回后交给技术。', 'thinking');

      if (submitToCarvis) {
        await window.carvis?.submitCommand(task, { speedMode });
      }

      await sleep(520);
      await Promise.all([
        sendEnvelope('manager', 'clerk', '文员任务'),
        sendEnvelope('manager', 'designer', '设计任务'),
        sendEnvelope('manager', 'researcher', '调研任务'),
      ]);

      for (const id of workerAgents) {
        showBubble(id, '收到任务，开始处理公开进度。', 'thinking');
      }
    },
    [appendLog, resetAgents, sendEnvelope, showBubble],
  );

  useEffect(() => {
    if (!shellState) return;

    const submittedCount = shellState.submittedCommands.length;
    if (submittedCount > previousSubmittedCount.current) {
      previousSubmittedCount.current = submittedCount;
      const remoteTask = shellState.submittedCommands.at(-1);

      if (remoteTask && !running) {
        void startVisualWorkflow(remoteTask, false);
      }
    }

    const nextOutputsCount = shellState.outputs.length;
    if (nextOutputsCount > previousOutputsCount.current) {
      previousOutputsCount.current = nextOutputsCount;
      setRunning(false);
      setAgent('tech', { status: 'sending', bubbleVisible: false });
      void sendEnvelope('tech', 'output', '最终输出');
      window.setTimeout(() => {
        setAgents((current) => {
          const next = { ...current };
          (Object.keys(next) as AgentId[]).forEach((id) => {
            next[id] = { ...next[id], status: 'done', bubbleVisible: false };
          });
          return next;
        });
      }, 3900);
    }

    for (const panel of shellState.panels) {
      const uiRole = carvisToUiRole[panel.role];
      const latestOutput = panel.latestOutput?.trim();

      if (latestOutput && latestOutput !== previousLatestOutput.current[panel.role]) {
        previousLatestOutput.current[panel.role] = latestOutput;
        const publicLine = lastUsefulLine(latestOutput);
        showBubble(uiRole, publicLine, mapCarvisStatus(panel.role, 'working', true));
        appendLog(`[${initialAgents[uiRole].name}] ${publicLine}`);
      }

      const doneKey = `${panel.role}:done:${panel.lastHeartbeatAt ?? ''}`;
      if (
        running &&
        panel.status === 'done' &&
        !animatedEvents.current.has(doneKey) &&
        (panel.role === 'writer' || panel.role === 'artist' || panel.role === 'researcher')
      ) {
        animatedEvents.current.add(doneKey);
        void sendEnvelope(uiRole, 'manager', `${initialAgents[uiRole].name}返回`);
      }

      const engineerStartKey = 'engineer-start';
      if (running && panel.role === 'engineer' && isEngineerActive(panel, latestOutput) && !animatedEvents.current.has(engineerStartKey)) {
        animatedEvents.current.add(engineerStartKey);
        void sendEnvelope('manager', 'tech', '交给技术');
      }
    }
  }, [appendLog, running, sendEnvelope, setAgent, shellState, showBubble, startVisualWorkflow]);

  const runWorkflow = useCallback(
    async (rawTask: string, speedMode: SpeedMode = 'auto') => {
      if (running) return;
      const task = rawTask.trim();
      if (!task) return;

      await startVisualWorkflow(task, true, speedMode);
    },
    [running, startVisualWorkflow],
  );

  const openPath = useCallback((path: string | undefined) => {
    if (!path) return;
    void window.carvis?.openOutput(path);
  }, []);

  const currentOutput = useMemo(() => {
    const latest = shellState?.outputs.at(-1);
    return latest ? mapOutput(latest) : undefined;
  }, [shellState]);

  const history = useMemo<HistoryItem[]>(() => {
    return (shellState?.outputs ?? [])
      .slice()
      .reverse()
      .map((output) => ({
        icon: 'doc',
        title: output.gamePreviewTitle || output.outputFolderPath.split('/').at(-1) || 'Carvis output',
        subtitle: output.outputFolderPath,
        path: output.outputFolderPath,
        time: formatTime(output.readyAt),
      }));
  }, [shellState]);

  const onBubbleComplete = useCallback((_agentId: AgentId) => {
    // The bubble remains visible until the 20 second idle timer hides it.
  }, []);

  return {
    agents,
    envelopes,
    outputLogs,
    currentOutput,
    history,
    remoteDraft: shellState?.remoteDraft,
    remoteAccess: shellState?.remoteAccess,
    running,
    runWorkflow,
    openPath,
    onBubbleComplete,
  };
}

function isEngineerActive(panel: CarvisPanel, latestOutput: string | undefined): boolean {
  return (
    panel.status === 'starting' ||
    panel.status === 'assigned' ||
    panel.status === 'working' ||
    (latestOutput !== undefined && latestOutput.length > 0)
  );
}

function mapCarvisStatus(role: CarvisAgentRole, status: CarvisAgentStatus, runActive: boolean): AgentStatus {
  if (status === 'ready' || status === 'retained' || status === 'idle' || status === 'waiting' || status === 'shutdown') {
    return 'idle';
  }
  if (!runActive) return 'idle';
  if (role === uiToCarvisRole.tech && (status === 'working' || status === 'assigned')) return 'producing';
  if (status === 'starting' || status === 'assigned' || status === 'working') return 'thinking';
  if (status === 'done') return 'done';
  if (status === 'failed') return 'rejected';
  return runActive ? 'thinking' : 'idle';
}

function lastUsefulLine(text: string): string {
  const line = text
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .at(-1);

  if (!line) return '正在处理任务。';
  return line.length > 95 ? `${line.slice(0, 95)}...` : line;
}

function mapOutput(output: CarvisOutputEntry): OutputItem {
  return {
    title: output.gamePreviewTitle || output.outputFolderPath.split('/').at(-1) || 'Carvis output',
    folderPath: output.outputFolderPath,
    readyAt: output.readyAt,
    previewText: output.previewText,
    files: [
      { label: 'game-preview.html', path: output.gamePreviewPath, size: output.gamePreviewBytes },
      { label: 'final-report.md', path: output.outputPath, size: output.finalReportBytes },
      { label: 'manifest.json', path: output.manifestPath, size: output.manifestBytes },
    ],
  };
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
