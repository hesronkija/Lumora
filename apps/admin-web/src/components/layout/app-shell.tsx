'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Sidebar } from './sidebar';
import { TopBar } from './topbar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar roles={session.user?.roles ?? []} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          schoolName={session.user?.tenantName ?? 'Lumora School'}
          userName={session.user?.name ?? ''}
          onSignOut={() => signOut({ callbackUrl: '/login' })}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
