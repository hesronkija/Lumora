'use client';

import { LogOut, User, Languages, Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { DEMO } from '@/lib/config';

interface TopBarProps {
  schoolName: string;
  userName: string;
  onSignOut: () => void;
}

export function TopBar({ schoolName, userName, onSignOut }: TopBarProps) {
  const { lang, setLang, t } = useI18n();
  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold">{schoolName}</h2>
        {DEMO && (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-inset ring-violet-600/20">
            <Sparkles className="h-3 w-3" /> {t('demoMode')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={() => setLang(lang === 'en' ? 'sw' : 'en')}
          className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="English / Kiswahili"
        >
          <Languages className="h-3.5 w-3.5" />
          {lang === 'en' ? 'SW' : 'EN'}
        </button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span>{userName}</span>
        </div>
        <button
          onClick={onSignOut}
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          {t('signout')}
        </button>
      </div>
    </header>
  );
}
