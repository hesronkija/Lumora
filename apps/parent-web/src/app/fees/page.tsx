'use client';

import { Shell } from '@/components/shell';
import { children, fmtTZS } from '@/lib/data';
import { useState } from 'react';
import { Copy, Check, Smartphone, Landmark } from 'lucide-react';

export default function FeesPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (cn: string) => {
    void navigator.clipboard?.writeText(cn);
    setCopied(cn); setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Shell title="Ada / Fees">
      <div className="space-y-4">
        {children.map((c) => {
          const balance = c.feeDue - c.feePaid;
          return (
            <div key={c.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="border-b bg-neutral-50 px-4 py-2.5">
                <p className="text-sm font-semibold">{c.name} · {c.klass}</p>
                <p className="text-[11px] text-neutral-500">Muhula wa 2 · lipa kabla ya {c.dueDate}</p>
              </div>
              <div className="space-y-3 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Jumla ya ada</span><span className="font-semibold">{fmtTZS(c.feeDue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Imelipwa</span><span className="font-semibold text-emerald-600">{fmtTZS(c.feePaid)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 text-sm">
                  <span className="font-semibold">Salio / Balance</span>
                  <span className={`font-bold ${balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{fmtTZS(balance)}</span>
                </div>

                {balance > 0 && (
                  <>
                    <button
                      onClick={() => copy(c.controlNo)}
                      className="flex w-full items-center justify-between rounded-xl border-2 border-dashed border-[#1a56db]/40 bg-blue-50 px-4 py-3"
                    >
                      <div className="text-left">
                        <p className="text-[10px] font-semibold uppercase text-[#1a56db]">Namba ya malipo / Control number</p>
                        <p className="font-mono text-lg font-bold tracking-wider text-neutral-900">{c.controlNo}</p>
                      </div>
                      {copied === c.controlNo ? <Check className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5 text-[#1a56db]" />}
                    </button>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-2 rounded-lg bg-neutral-50 p-2.5">
                        <Smartphone className="h-4 w-4 text-emerald-600" />
                        <span>M-Pesa · Tigo Pesa · Airtel: lipa kwa namba hii</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg bg-neutral-50 p-2.5">
                        <Landmark className="h-4 w-4 text-[#1a56db]" />
                        <span>NMB · CRDB: tawi, wakala au app</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-neutral-400">Risiti hutumwa kwa SMS mara malipo yanapopokelewa — kawaida ndani ya dakika moja.</p>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}
