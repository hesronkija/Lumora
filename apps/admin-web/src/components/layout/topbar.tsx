'use client';

import { LogOut, User } from 'lucide-react';

interface TopBarProps {
  schoolName: string;
  userName: string;
  onSignOut: () => void;
}

export function TopBar({ schoolName, userName, onSignOut }: TopBarProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div>
        <h2 className="text-sm font-semibold">{schoolName}</h2>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span>{userName}</span>
        </div>
        <button
          onClick={onSignOut}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </header>
  );
}
