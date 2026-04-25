'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  DollarSign,
  CreditCard,
  BookMarked,
  UserCheck,
  Home,
  Truck,
  BarChart3,
  Settings,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  phase: number;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['*'], phase: 0 },
  { href: '/users', label: 'Users & Roles', icon: Users, roles: ['owner', 'headteacher', 'hr'], phase: 0 },
  { href: '/admissions', label: 'Admissions', icon: GraduationCap, roles: ['owner', 'headteacher', 'hr'], phase: 1 },
  { href: '/students', label: 'Students', icon: Users, roles: ['owner', 'headteacher', 'teacher'], phase: 1 },
  { href: '/academic', label: 'Academic', icon: BookOpen, roles: ['owner', 'headteacher', 'teacher'], phase: 1 },
  { href: '/attendance', label: 'Attendance', icon: UserCheck, roles: ['teacher', 'class_teacher', 'headteacher'], phase: 1 },
  { href: '/fees', label: 'Fees & Billing', icon: DollarSign, roles: ['bursar', 'owner', 'headteacher'], phase: 2 },
  { href: '/payments', label: 'Payments', icon: CreditCard, roles: ['bursar', 'owner'], phase: 2 },
  { href: '/accounting', label: 'Accounting', icon: BookMarked, roles: ['bursar', 'accountant', 'owner'], phase: 3 },
  { href: '/payroll', label: 'Payroll', icon: DollarSign, roles: ['hr', 'bursar', 'owner'], phase: 3 },
  { href: '/boarding', label: 'Boarding', icon: Home, roles: ['matron', 'headteacher', 'owner'], phase: 4 },
  { href: '/transport', label: 'Transport & Meals', icon: Truck, roles: ['driver', 'headteacher', 'owner'], phase: 4 },
  { href: '/reports', label: 'Reports', icon: BarChart3, roles: ['owner', 'headteacher', 'bursar', 'auditor'], phase: 0 },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['owner'], phase: 0 },
];

export function Sidebar({ roles }: { roles: string[] }) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      item.roles.includes('*') ||
      item.roles.some((r) => roles.includes(r)),
  );

  return (
    <aside className="flex w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center px-6 border-b">
        <span className="text-lg font-bold text-primary">Lumora</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                  {item.phase > 0 && !isActive && (
                    <span className="ml-auto text-xs opacity-40">P{item.phase}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
