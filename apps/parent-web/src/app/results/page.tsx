'use client';

import { Shell } from '@/components/shell';
import { children } from '@/lib/data';
import { useState } from 'react';

export default function ResultsPage() {
  const [sel, setSel] = useState(0);
  const c = children[sel]!;

  return (
    <Shell title="Matokeo / Results">
      <div className="mb-4 flex gap-2">
        {children.map((ch, i) => (
          <button key={ch.id} onClick={() => setSel(i)}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${sel === i ? 'border-[#1a56db] bg-blue-50 text-[#1a56db]' : 'bg-white text-neutral-500'}`}>
            {ch.name.split(' ')[0]}
          </button>
        ))}
      </div>

      <div className="mb-4 rounded-2xl bg-[#1a56db] p-5 text-white">
        <p className="text-xs text-white/75">Mtihani wa mwisho wa Muhula 1 · {c.klass}</p>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <p className="text-3xl font-black">{c.average}%</p>
            <p className="text-xs text-white/75">Wastani / Average</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black">#{c.position}</p>
            <p className="text-xs text-white/75">kati ya {c.classSize}</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        {c.subjects.map((s) => (
          <div key={s.name} className="flex items-center justify-between border-b px-4 py-3 last:border-0">
            <span className="text-sm">{s.name}</span>
            <span className="flex items-center gap-3">
              <span className="text-sm font-semibold">{s.score}%</span>
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold
                ${s.grade === 'A' ? 'bg-emerald-100 text-emerald-700' : s.grade === 'B' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                {s.grade}
              </span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-neutral-400">Ripoti kamili (PDF) inapatikana ofisini au kwenye ukurasa wa mwanafunzi.</p>
    </Shell>
  );
}
