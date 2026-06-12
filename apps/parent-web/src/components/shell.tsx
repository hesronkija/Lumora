'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Wallet, GraduationCap, Bell, MessageCircle } from 'lucide-react';
import type { ReactNode } from 'react';

const TABS = [
  { href: '/', icon: Home, label: 'Nyumbani' },
  { href: '/fees', icon: Wallet, label: 'Ada' },
  { href: '/results', icon: GraduationCap, label: 'Matokeo' },
  { href: '/messages', icon: Bell, label: 'Taarifa' },
  { href: '/assistant', icon: MessageCircle, label: 'Msaidizi' },
];

export function Shell({ children, title }: { children: ReactNode; title?: string }) {
  const pathname = usePathname();
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-[#1a56db] px-4 py-3.5 text-white">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-sm font-bold">L</span>
        <div>
          <h1 className="text-sm font-bold leading-tight">{title ?? 'Lumora Mzazi'}</h1>
          <p className="text-[11px] leading-tight text-white/75">Green Valley Primary School</p>
        </div>
      </header>
      <main className="flex-1 px-4 pb-24 pt-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-white">
        <div className="mx-auto flex max-w-md">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link key={tab.href} href={tab.href}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium ${active ? 'text-[#1a56db]' : 'text-neutral-400'}`}>
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
