'use client';

// A pop-up-book stage: children sit on layers at different depths, and the
// whole stage leans toward the pointer. No WebGL, just CSS 3D transforms.

import { useRef } from 'react';

export function Tilt({ className = '', children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  function lean(x: number, y: number) {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      ref.current?.style.setProperty('--ry', `${(x * 14).toFixed(2)}deg`);
      ref.current?.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`);
    });
  }

  return (
    <div
      ref={ref}
      className={`tilt3d ${className}`}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return;
        const box = e.currentTarget.getBoundingClientRect();
        lean((e.clientX - box.left) / box.width - 0.5, (e.clientY - box.top) / box.height - 0.5);
      }}
      onPointerLeave={() => lean(0, 0)}
    >
      <div className="tilt-stage">{children}</div>
    </div>
  );
}
