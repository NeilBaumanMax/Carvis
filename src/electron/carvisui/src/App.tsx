import { useEffect, useRef, useState } from 'react';
import { agentOrder } from './data/agents';
import { Workstation } from './components/Workstation';
import { EnvelopeLayer } from './components/EnvelopeLayer';
import { RightPanel } from './components/RightPanel';
import { useAgentWorkflow } from './hooks/useAgentWorkflow';
import { assetPath } from './assets';

export default function App() {
  const [input, setInput] = useState('');
  const [floatingDraft, setFloatingDraft] = useState('');
  const lastDraftAt = useRef<string | undefined>(undefined);
  const floatTimer = useRef<number | undefined>(undefined);
  const { agents, envelopes, outputLogs, currentOutput, history, remoteDraft, remoteAccess, running, runWorkflow, openPath, onBubbleComplete } =
    useAgentWorkflow();

  useEffect(() => {
    if (!remoteDraft || remoteDraft.source === 'electron' || remoteDraft.updatedAt === lastDraftAt.current) {
      return;
    }

    lastDraftAt.current = remoteDraft.updatedAt;
    setInput(remoteDraft.text);
    setFloatingDraft(remoteDraft.text);

    if (floatTimer.current !== undefined) {
      window.clearTimeout(floatTimer.current);
    }

    floatTimer.current = window.setTimeout(() => {
      setFloatingDraft('');
      floatTimer.current = undefined;
    }, 2600);
  }, [remoteDraft]);

  useEffect(() => () => {
    if (floatTimer.current !== undefined) {
      window.clearTimeout(floatTimer.current);
    }
  }, []);

  const handleStart = async () => {
    const submitted = input.trim();
    if (!submitted) return;

    setInput('');
    await runWorkflow(submitted);
  };

  return (
    <main className="app-shell">
      <div className="pixel-window">
        <header className="top-bar">
          <div className="title-plaque">
            <img className="title-sprout" src={assetPath('assets/ui/leaf-icon.png')} alt="" draggable={false} />
            <h1>Carvis</h1>
          </div>
          <div className="remote-access">
            <span>IP {remoteAccess?.ip ?? '检测中'}</span>
            <strong>{remoteAccess?.phoneUrl ?? '等待 NAS 地址'}</strong>
          </div>
        </header>
        <div className="main-layout">
          <section className="office-stage">
            <div className="scene-board">
              {floatingDraft ? (
                <div className="remote-draft-float" aria-live="polite">
                  {floatingDraft}
                </div>
              ) : null}
              <EnvelopeLayer envelopes={envelopes} />
              <div className="workstation-grid">
                {agentOrder.map((id) => (
                  <Workstation
                    agent={agents[id]}
                    key={id}
                    onBubbleComplete={() => onBubbleComplete(id)}
                  />
                ))}
              </div>
            </div>
          </section>
          <RightPanel
            input={input}
            running={running}
            outputLogs={outputLogs}
            currentOutput={currentOutput}
            history={history}
            onInputChange={setInput}
            onStart={handleStart}
            onOpenPath={openPath}
          />
        </div>
      </div>
    </main>
  );
}
