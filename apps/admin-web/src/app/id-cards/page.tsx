'use client';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Button } from '@/components/ui/primitives';
import { students } from '@/lib/demo-data';
import { Barcode } from '@/components/barcode';
import { useState } from 'react';
import { Printer } from 'lucide-react';

/**
 * Print-ready student ID cards (CR80 size, 8 per A4 sheet).
 * Barcode = admission number → scan at the gate, library or canteen.
 */
const KLASSES = ['All', ...Array.from({ length: 7 }, (_, i) => `Std ${i + 1} A`)];

export default function IdCardsPage() {
  const [klass, setKlass] = useState('Std 7 A');
  const list = students.filter((s) => klass === 'All' || s.klass === klass);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="print:hidden">
          <PageHeader
            title="Student ID Cards"
            subtitle="CR80 cards, 8 per A4 sheet — barcode works at the gate, library and canteen"
            action={<Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print sheet</Button>}
          />
          <div className="mt-4 flex gap-1 overflow-x-auto rounded-lg border bg-card p-1" style={{ maxWidth: 'fit-content' }}>
            {KLASSES.map((k) => (
              <button key={k} onClick={() => setKlass(k)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${klass === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {k}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 print:grid-cols-2 print:gap-2">
          {list.map((s) => (
            <div key={s.id} className="overflow-hidden rounded-xl border bg-white text-black shadow-sm print:break-inside-avoid" style={{ aspectRatio: '1.586' }}>
              <div className="flex items-center justify-between bg-[#1a56db] px-3 py-1.5 text-white">
                <span className="text-[11px] font-black uppercase tracking-wide">Green Valley Primary</span>
                <span className="text-[9px]">2025/2026</span>
              </div>
              <div className="flex gap-3 p-3">
                <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded-md bg-neutral-200 text-lg font-black text-neutral-500">
                  {s.name.split(' ').map((p) => p[0]).join('')}
                </div>
                <div className="min-w-0 text-[11px] leading-tight">
                  <p className="truncate text-[13px] font-black">{s.name}</p>
                  <p className="mt-0.5"><span className="font-semibold">Adm:</span> {s.admissionNo}</p>
                  <p><span className="font-semibold">Class:</span> {s.klass}</p>
                  <p><span className="font-semibold">Guardian:</span> {s.guardianPhone}</p>
                  <p className="mt-0.5 text-[9px] text-neutral-500">If found, return to school · Akipotea mrudishe shuleni</p>
                </div>
              </div>
              <div className="flex justify-center pb-2 text-black">
                <Barcode value={s.admissionNo.replace(/\//g, '-')} height={26} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
