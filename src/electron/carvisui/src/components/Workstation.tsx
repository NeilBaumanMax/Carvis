import type { AgentState } from '../types';
import { AgentCharacter } from './AgentCharacter';
import { ThoughtBubble } from './ThoughtBubble';

type WorkstationProps = {
  agent: AgentState;
  onBubbleComplete?: () => void;
};

export function Workstation({ agent, onBubbleComplete }: WorkstationProps) {
  return (
    <section className={`workstation workstation-${agent.id}`} data-agent-id={agent.id}>
      <ThoughtBubble
        visible={agent.bubbleVisible}
        text={agent.bubbleText}
        streaming
        speed={22}
        onStreamComplete={onBubbleComplete}
      />
      <div className="station-scene">
        <AgentCharacter agent={agent} />
      </div>
    </section>
  );
}
