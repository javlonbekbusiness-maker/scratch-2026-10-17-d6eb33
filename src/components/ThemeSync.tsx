'use client';

import { useEffect } from 'react';

/**
 * Safety net for the theme: the inline script sets it before first paint, but if React ever
 * re-creates the root element (e.g. after recovering from an error) the class could be lost.
 */
export function ThemeSync() {
  useEffect(() => {
    let light = false;
    try {
      light = localStorage.getItem('theme') === 'light';
    } catch {}
    document.documentElement.classList.toggle('dark', !light);
  }, []);
  return null;
}
