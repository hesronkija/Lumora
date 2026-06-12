'use client';

/** Lightweight shadcn-style primitives shared across every page. */
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-xl border bg-card shadow-sm', className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between border-b px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, sub, icon, tone = 'default' }: {
  label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
  const tones = {
    default: 'text-foreground', good: 'text-emerald-600',
    warn: 'text-amber-600', bad: 'text-red-600',
  } as const;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground/60">{icon}</span>}
      </div>
      <p className={cn('mt-2 text-2xl font-bold tracking-tight', tones[tone])}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'green' | 'amber' | 'red' | 'blue' | 'gray' | 'violet' }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    red: 'bg-red-50 text-red-700 ring-red-600/20',
    blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
    gray: 'bg-muted text-muted-foreground ring-border',
  } as const;
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone])}>
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Table({ headers, children }: { headers: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            {headers.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full max-w-xs rounded-lg border bg-card px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
    />
  );
}

export function Button({ children, onClick, variant = 'primary', type = 'button', disabled }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'outline' | 'ghost';
  type?: 'button' | 'submit'; disabled?: boolean;
}) {
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    outline: 'border bg-card hover:bg-accent',
    ghost: 'hover:bg-accent',
  } as const;
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn('inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium shadow-sm transition-colors disabled:opacity-50', variants[variant])}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ pct, tone = 'blue' }: { pct: number; tone?: 'blue' | 'green' | 'amber' | 'red' }) {
  const tones = { blue: 'bg-primary', green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500' } as const;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn('h-full rounded-full transition-all', tones[tone])} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}
