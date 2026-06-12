'use client';

/**
 * User-experience preferences: theme (light/dark) and school accent colour.
 * Persisted per device; applied as CSS variables so every component follows.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';

export const ACCENTS = [
  { name: 'Lumora Blue', h: 221, s: 83, l: 53 },
  { name: 'Safari Green', h: 158, s: 64, l: 38 },
  { name: 'Kilimanjaro Purple', h: 262, s: 70, l: 50 },
  { name: 'Zanzibar Teal', h: 188, s: 78, l: 36 },
  { name: 'Serengeti Amber', h: 32, s: 90, l: 44 },
  { name: 'Uhuru Red', h: 0, s: 72, l: 46 },
] as const;

interface Prefs {
  theme: Theme;
  accent: number; // index into ACCENTS
  setTheme: (t: Theme) => void;
  setAccent: (i: number) => void;
}

const PrefsContext = createContext<Prefs>({
  theme: 'light', accent: 0, setTheme: () => undefined, setAccent: () => undefined,
});

function apply(theme: Theme, accentIdx: number) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  const a = ACCENTS[accentIdx] ?? ACCENTS[0];
  root.style.setProperty('--primary', `${a.h} ${a.s}% ${theme === 'dark' ? Math.min(a.l + 8, 62) : a.l}%`);
  root.style.setProperty('--ring', `${a.h} ${a.s}% ${a.l}%`);
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [accent, setAccentState] = useState(0);

  useEffect(() => {
    const t = (window.localStorage.getItem('lumora.theme') as Theme | null) ?? 'light';
    const a = parseInt(window.localStorage.getItem('lumora.accent') ?? '0', 10) || 0;
    setThemeState(t); setAccentState(a); apply(t, a);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t); window.localStorage.setItem('lumora.theme', t); apply(t, accent);
  };
  const setAccent = (i: number) => {
    setAccentState(i); window.localStorage.setItem('lumora.accent', String(i)); apply(theme, i);
  };

  return <PrefsContext.Provider value={{ theme, accent, setTheme, setAccent }}>{children}</PrefsContext.Provider>;
}

export const usePreferences = () => useContext(PrefsContext);
