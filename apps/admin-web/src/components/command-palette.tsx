'use client';

/**
 * Global search (Ctrl/⌘+K): students, staff and pages from anywhere.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { students, staff } from '@/lib/demo-data';
import { Search, Users, Briefcase, ArrowRight } from 'lucide-react';

const PAGES = [
  ['Dashboard', '/dashboard'], ['Students', '/students'], ['Admissions', '/admissions'],
  ['Academic', '/academic'], ['Attendance', '/attendance'], ['Exams & Grading', '/exams'],
  ['Fees & Billing', '/fees'], ['Payments', '/payments'], ['Accounting', '/accounting'],
  ['Staff / HR', '/hr'], ['Payroll', '/payroll'], ['Boarding', '/boarding'],
  ['Transport & Meals', '/transport'], ['Communications', '/comms'], ['Reports', '/reports'],
  ['AI Assistant', '/ai'], ['Users & Roles', '/users'], ['Settings', '/settings'],
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o); setQ(''); setSel(0);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30); }, [open]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) {
      return PAGES.slice(0, 8).map(([label, href]) => ({ type: 'page' as const, label, sub: href, href }));
    }
    const pages = PAGES.filter(([l]) => l.toLowerCase().includes(needle))
      .map(([label, href]) => ({ type: 'page' as const, label, sub: href, href }));
    const studs = students
      .filter((s) => s.name.toLowerCase().includes(needle) || s.admissionNo.toLowerCase().includes(needle))
      .slice(0, 5)
      .map((s) => ({ type: 'student' as const, label: s.name, sub: `${s.admissionNo} · ${s.klass}`, href: `/students/${s.id}` }));
    const stf = staff
      .filter((s) => s.name.toLowerCase().includes(needle) || s.position.toLowerCase().includes(needle))
      .slice(0, 4)
      .map((s) => ({ type: 'staff' as const, label: s.name, sub: `${s.position} · ${s.employeeNo}`, href: '/hr' }));
    return [...studs, ...stf, ...pages].slice(0, 10);
  }, [q]);

  const go = (href: string) => { setOpen(false); router.push(href); };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[12vh]" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
              if (e.key === 'Enter' && results[sel]) go(results[sel]!.href);
            }}
            placeholder="Search students, staff, pages…  ·  Tafuta…"
            className="w-full bg-transparent py-3.5 text-sm focus:outline-none"
          />
          <kbd className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No results</li>}
          {results.map((r, i) => (
            <li key={`${r.type}-${r.label}-${i}`}>
              <button
                onMouseEnter={() => setSel(i)}
                onClick={() => go(r.href)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${i === sel ? 'bg-primary text-primary-foreground' : ''}`}
              >
                {r.type === 'student' ? <Users className="h-4 w-4 shrink-0 opacity-60" />
                  : r.type === 'staff' ? <Briefcase className="h-4 w-4 shrink-0 opacity-60" />
                  : <ArrowRight className="h-4 w-4 shrink-0 opacity-60" />}
                <span className="flex-1 font-medium">{r.label}</span>
                <span className={`text-xs ${i === sel ? 'opacity-80' : 'text-muted-foreground'}`}>{r.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
