import type { Envelope } from '../types';
import { assetPath } from '../assets';

type EnvelopeLayerProps = {
  envelopes: Envelope[];
};

export function EnvelopeLayer({ envelopes }: EnvelopeLayerProps) {
  return (
    <div className="envelope-layer" aria-hidden="true">
      {envelopes.map((envelope) => (
        <div
          className={`flying-envelope route-${envelope.from}-to-${envelope.to}`}
          key={envelope.id}
        >
          <img
            className="mail-flight-art"
            src={assetPath('assets/generated-ui/mail-flight.webp')}
            alt=""
            draggable={false}
          />
          <span className="mail-label">{envelope.label}</span>
        </div>
      ))}
    </div>
  );
}
