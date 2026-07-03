import type { ButtonHTMLAttributes, ReactNode } from 'react';

type PixelButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function PixelButton({ children, ...props }: PixelButtonProps) {
  return (
    <button className="pixel-button" {...props}>
      {children}
    </button>
  );
}
