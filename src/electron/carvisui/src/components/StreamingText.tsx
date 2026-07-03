import { useEffect, useRef, useState } from 'react';

type StreamingTextProps = {
  text: string;
  speed?: number;
  onComplete?: () => void;
};

export function StreamingText({ text, speed = 24, onComplete }: StreamingTextProps) {
  const [visibleText, setVisibleText] = useState('');
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let index = 0;
    const characters = Array.from(text);
    setVisibleText('');

    if (!text) {
      onCompleteRef.current?.();
      return;
    }

    const timer = window.setInterval(() => {
      index += 1;
      setVisibleText(characters.slice(0, index).join(''));

      if (index >= characters.length) {
        window.clearInterval(timer);
        onCompleteRef.current?.();
      }
    }, speed);

    return () => window.clearInterval(timer);
  }, [text, speed]);

  return (
    <span className="streaming-text">
      {visibleText}
      <span className="streaming-cursor" />
    </span>
  );
}
