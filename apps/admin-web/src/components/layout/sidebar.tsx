'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useI18n, type TKey } from '@/lib/i18n';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, DollarSign, CreditCard,
  BookMarked, UserCheck, Home, Truck, BarChart3, Settings, Briefcase,
  ClipboardList, MessageSquare, Sparkles,
} from 'lucide-react';

interface NavItem {
  href: string;
  key: TKey;
  icon: import('lucide-react').LucideIcon;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard, roles: ['*'] },
  { href: '/users', key: 'users', icon: Users, roles: ['owner', 'headteacher', 'hr'] },
  { href: '/admissions', key: 'admissions', icon: GraduationCap, roles: ['owner', 'headteacher', 'hr'] },
  { href: '/students', key: 'students', icon: Users, roles: ['owner', 'headteacher', 'teacher'] },
  { href: '/academic', key: 'academic', icon: BookOpen, roles: ['owner', 'headteacher', 'teacher'] },
  { href: '/attendance', key: 'attendance', icon: UserCheck, roles: ['teacher', 'class_teacher', 'headteacher', 'owner'] },
  { href: '/exams', key: 'exams', icon: ClipboardList, roles: ['teacher', 'headteacher', 'owner'] },
  { href: '/fees', key: 'fees', icon: DollarSign, roles: ['bursar', 'owner', 'headteacher'] },
  { href: '/payments', key: 'payments', icon: CreditCard, roles: ['bursar', 'owner'] },
  { href: '/accounting', key: 'accounting', icon: BookMarked, roles: ['bursar', 'accountant', 'owner'] },
  { href: '/hr', key: 'hr', icon: Briefcase, roles: ['hr', 'headteacher', 'owner'] },
  { href: '/payroll', key: 'payroll', icon: DollarSign, roles: ['hr', 'bursar', 'owner'] },
  { href: '/boarding', key: 'boarding', icon: Home, roles: ['matron', 'headteacher', 'owner'] },
  { href: '/transport', key: 'transport', icon: Truck, roles: ['driver', 'headteacher', 'owner'] },
  { href: '/comms', key: 'comms', icon: MessageSquare, roles: ['headteacher', 'owner'] },
  { href: '/reports', key: 'reports', icon: BarChart3, roles: ['owner', 'headteacher', 'bursar', 'auditor'] },
  { href: '/ai', key: 'ai', icon: Sparkles, roles: ['owner', 'headteacher', 'teacher'] },
  { href: '/settings', key: 'settings', icon: Settings, roles: ['owner'] },
];

export function Sidebar({ roles, onNavigate }: { roles: string[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = useI18n();

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles.includes('*') || item.roles.some((r) => roles.includes(r)),
  );

  return (
    <aside className="flex w-60 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">L</span>
        <span className="text-lg font-bold tracking-tight">Lumora</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => onNavigate?.()}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary font-medium text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {t(item.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t px-5 py-3 text-[11px] text-muted-foreground">
        Lumora · Shule Bora Tanzania
      </div>
    </aside>
  );
}
