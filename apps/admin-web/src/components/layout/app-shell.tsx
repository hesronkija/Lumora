'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Sidebar } from './sidebar';
import { TopBar } from './topbar';
import { DEMO } from '@/lib/config';

const DEMO_SESSION = {
  name: 'Upendo Mahenge',
  tenantName: 'Green Valley Primary School',
  roles: ['owner', 'headteacher'],
};

export function AppShell({ children }: { children: React.ReactNode }) {
  // In demo mode the shell renders immediately with a built-in session, so
  // the system is explorable without Keycloak. With an API configured, the
  // normal next-auth → Keycloak flow applies.
  if (DEMO) {
    return (
      <Shell roles={DEMO_SESSION.roles} schoolName={DEMO_SESSION.tenantName} userName={DEMO_SESSION.name} onSignOut={() => undefined}>
        {children}
      </Shell>
    );
  }
  return <AuthedShell>{children}</AuthedShell>;
}

function AuthedShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!session) return null;

  return (
    <Shell
      roles={session.user?.roles ?? []}
      schoolName={session.user?.tenantName ?? 'Lumora School'}
      userName={session.user?.name ?? ''}
      onSignOut={() => signOut({ callbackUrl: '/login' })}
    >
      {children}
    </Shell>
  );
}

function Shell({ children, roles, schoolName, userName, onSignOut }: {
  children: React.ReactNode; roles: string[]; schoolName: string;
  userName: string; onSignOut: () => void;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar roles={roles} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar schoolName={schoolName} userName={userName} onSignOut={onSignOut} />
        <main className="flex-1 overflow-y-auto bg-muted/20 p-6">{children}</main>
      </div>
    </div>
  );
}
