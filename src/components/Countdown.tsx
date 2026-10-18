'use client';

import { useEffect, useState } from 'react';

function fmt(ms: number) {
  if (ms <= 0) return '0:00:00';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const hms = `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return d > 0 ? `${d}d ${hms}` : hms;
}

export function Countdown({ until }: { until: string }) {
  const target = new Date(until).getTime();
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(target - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return <span className="tabular-nums">{left === null ? '…' : fmt(left)}</span>;
}
