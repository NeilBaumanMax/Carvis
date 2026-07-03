import { StreamingText } from './StreamingText';
import { assetPath } from '../assets';

type ThoughtBubbleProps = {
  visible: boolean;
  text: string;
  streaming?: boolean;
  speed?: number;
  onStreamComplete?: () => void;
};

export function ThoughtBubble({
  visible,
  text,
  streaming = true,
  speed = 24,
  onStreamComplete,
}: ThoughtBubbleProps) {
  if (!visible) return null;

  return (
    <div className="thought-bubble">
      <img
        className="thought-bubble-frame"
        src={assetPath('assets/generated-ui/bubble-frame.png')}
        alt=""
        draggable={false}
      />
      <div className="thought-bubble-content">
        {streaming ? (
          <StreamingText text={text || '正在思考...'} speed={speed} onComplete={onStreamComplete} />
        ) : (
          <span>{text}</span>
        )}
      </div>
    </div>
  );
}
