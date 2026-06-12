'use client';

import { Shell } from '@/components/shell';
import { children, announcements, fmtTZS } from '@/lib/data';
import Link from 'next/link';
import { ChevronRight, AlertCircle } from 'lucide-react';

export default function HomePage() {
  return (
    <Shell>
      <p className="mb-4 text-sm text-neutral-500">Habari, <span className="font-semibold text-neutral-900">Mzazi Mushi</span> 👋</p>

      <div className="space-y-3">
        {children.map((c) => {
          const balance = c.feeDue - c.feePaid;
          return (
            <div key={c.id} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 font-bold text-[#1a56db]">{c.photoInitials}</div>
                <div className="flex-1">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-neutral-500">{c.klass} · {c.admissionNo}</p>
                </div>
                {balance > 0
                  ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">Deni {fmtTZS(balance)}</span>
                  : <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Ada imelipwa ✓</span>}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Link href="/fees" className="rounded-xl bg-neutral-50 py-2">
                  <p className="text-sm font-bold">{Math.round((c.feePaid / c.feeDue) * 100)}%</p>
                  <p className="text-[10px] text-neutral-500">Ada / Fees</p>
                </Link>
                <div className="rounded-xl bg-neutral-50 py-2">
                  <p className="text-sm font-bold">{c.attendanceRate}%</p>
                  <p className="text-[10px] text-neutral-500">Mahudhurio</p>
                </div>
                <Link href="/results" className="rounded-xl bg-neutral-50 py-2">
                  <p className="text-sm font-bold">#{c.position}</p>
                  <p className="text-[10px] text-neutral-500">Nafasi darasani</p>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="mb-2 mt-6 text-sm font-bold">Taarifa za hivi karibuni</h2>
      <div className="space-y-2">
        {announcements.slice(0, 2).map((a, i) => (
          <Link key={i} href="/messages" className="flex items-center gap-3 rounded-xl border bg-white p-3 shadow-sm">
            {a.urgent && <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.title}</p>
              <p className="truncate text-xs text-neutral-500">{a.body}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
          </Link>
        ))}
      </div>
    </Shell>
  );
}
