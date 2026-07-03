import { useState } from 'react';
import { agentOrder } from './data/agents';
import { Workstation } from './components/Workstation';
import { EnvelopeLayer } from './components/EnvelopeLayer';
import { RightPanel } from './components/RightPanel';
import { useAgentWorkflow } from './hooks/useAgentWorkflow';
import { assetPath } from './assets';

export default function App() {
  const [input, setInput] = useState('');
  const { agents, envelopes, outputLogs, currentOutput, history, running, runWorkflow, openPath, onBubbleComplete } =
    useAgentWorkflow();
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
        </header>
        <div className="main-layout">
          <section className="office-stage">
            <div className="scene-board">
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
