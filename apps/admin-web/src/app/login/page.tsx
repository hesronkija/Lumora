'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-muted/40">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold text-primary">Lumora</h1>
          <p className="text-sm text-muted-foreground">Tanzania School Management System</p>
        </div>

        <button
          onClick={() => signIn('keycloak', { callbackUrl: '/dashboard' })}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Sign in with School Account
        </button>

        <p className="text-center text-xs text-muted-foreground">
          MFA required for privileged roles.
        </p>
      </div>
    </div>
  );
}
