import React, { useEffect, useRef, useState } from 'react';
import { Bot, Grip } from 'lucide-react';

const STORAGE_KEY = 'finverse_ai_shortcut_position';

function initialPosition() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) return saved;
  } catch { /* use the default corner */ }
  return { x: Math.max(16, window.innerWidth - 82), y: Math.max(16, window.innerHeight - 112) };
}

export default function AIChatShortcut({ onOpen }) {
  const [position, setPosition] = useState(initialPosition);
  const drag = useRef(null);
  const moved = useRef(false);

  useEffect(() => {
    const move = (event) => {
      if (!drag.current) return;
      const x = Math.min(Math.max(8, event.clientX - drag.current.dx), window.innerWidth - 64);
      const y = Math.min(Math.max(8, event.clientY - drag.current.dy), window.innerHeight - 64);
      if (Math.abs(x - drag.current.startX) + Math.abs(y - drag.current.startY) > 4) moved.current = true;
      setPosition({ x, y });
    };
    const up = () => {
      if (!drag.current) return;
      drag.current = null;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [position]);

  return (
    <button
      type="button"
      onPointerDown={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        drag.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top, startX: position.x, startY: position.y };
        moved.current = false;
      }}
      onClick={() => { if (!moved.current) onOpen(); }}
      aria-label="Open Finverse AI financial advisor; drag to move"
      title="Open AI financial advisor · drag to move"
      style={{ left: position.x, top: position.y, touchAction: 'none' }}
      className="fixed z-40 flex h-14 w-14 cursor-grab items-center justify-center rounded-full bg-emerald-800 text-white shadow-xl ring-4 ring-emerald-800/15 transition hover:bg-emerald-700 active:cursor-grabbing"
    >
      <Bot className="h-6 w-6" />
      <Grip className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-white p-0.5 text-emerald-900 shadow" />
    </button>
  );
}
