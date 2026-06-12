'use client';

import { LogOut, User, Languages, Sparkles, Moon, Sun, Search, Menu } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { usePreferences } from '@/lib/preferences';
import { DEMO } from '@/lib/config';

interface TopBarProps {
  schoolName: string;
  userName: string;
  onSignOut: () => void;
  onMenuToggle?: () => void;
}

export function TopBar({ schoolName, userName, onSignOut, onMenuToggle }: TopBarProps) {
  const { lang, setLang, t } = useI18n();
  const { theme, setTheme } = usePreferences();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle} className="rounded-lg border p-2 text-muted-foreground hover:bg-accent lg:hidden" aria-label="Menu">
          <Menu className="h-4 w-4" />
        </button>
        <h2 className="hidden text-sm font-semibold sm:block">{schoolName}</h2>
        {DEMO && (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-inset ring-violet-600/20 dark:bg-violet-950 dark:text-violet-300">
            <Sparkles className="h-3 w-3" /> {t('demoMode')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
          className="hidden items-center gap-2 rounded-lg border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent md:flex"
        >
          <Search className="h-3.5 w-3.5" /> {t('search')} <kbd className="rounded border px-1 text-[10px]">⌘K</kbd>
        </button>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="rounded-lg border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Light / Dark"
        >
          {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={() => setLang(lang === 'en' ? 'sw' : 'en')}
          className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="English / Kiswahili"
        >
          <Languages className="h-3.5 w-3.5" />
          {lang === 'en' ? 'SW' : 'EN'}
        </button>
        <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
          <User className="h-4 w-4" />
          <span>{userName}</span>
        </div>
        <button
          onClick={onSignOut}
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">{t('signout')}</span>
        </button>
      </div>
    </header>
  );
}
