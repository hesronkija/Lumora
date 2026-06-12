'use client';

import { Shell } from '@/components/shell';
import { announcements } from '@/lib/data';
import { Bell, AlertCircle } from 'lucide-react';

export default function MessagesPage() {
  return (
    <Shell title="Taarifa / Announcements">
      <div className="space-y-3">
        {announcements.map((a, i) => (
          <div key={i} className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              {a.urgent ? <AlertCircle className="h-4 w-4 text-amber-500" /> : <Bell className="h-4 w-4 text-neutral-400" />}
              <p className="flex-1 text-sm font-semibold">{a.title}</p>
              <span className="text-[11px] text-neutral-400">{a.date}</span>
            </div>
            <p className="mt-2 text-sm text-neutral-600">{a.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-[11px] text-neutral-400">
        Taarifa hizi pia hutumwa kwa SMS na WhatsApp — hata bila intaneti.
      </p>
    </Shell>
  );
}
