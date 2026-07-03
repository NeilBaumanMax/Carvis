import type { AgentState } from '../types';
import { assetPath } from '../assets';

type AgentCharacterProps = {
  agent: AgentState;
};

export function AgentCharacter({ agent }: AgentCharacterProps) {
  const artSrc = getAgentArtSource(agent);

  return (
    <div className={`agent-character agent-${agent.id} status-${agent.status}`}>
      <img
        className="agent-art"
        src={artSrc}
        alt={`${agent.name} pixel workstation asset`}
      />
    </div>
  );
}

function getAgentArtSource(agent: AgentState) {
  const motion = agent.motionAssets;

  if (motion) {
    if (motion[agent.status]) return motion[agent.status];
    if (agent.status === 'reviewing') return motion.thinking ?? motion.idle ?? fallbackArt(agent);
    if (agent.status === 'done') return motion.done ?? motion.approved ?? motion.idle ?? fallbackArt(agent);
    if (agent.status === 'rejected') return motion.reworking ?? motion.idle ?? fallbackArt(agent);
    return motion.idle ?? fallbackArt(agent);
  }

  return fallbackArt(agent);
}

function fallbackArt(agent: AgentState) {
  return agent.sceneAsset ?? assetPath(`assets/crops/user/${agent.id}-scene.png`);
}
