'use client';

import { Shell } from '@/components/shell';
import { children, fmtTZS } from '@/lib/data';
import { useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; text: string };

function answer(q: string): string {
  const s = q.toLowerCase();
  const amani = children[0]!, neema = children[1]!;
  if (/(ada|fee|deni|balance|lipa|karo)/.test(s)) {
    const bal = amani.feeDue - amani.feePaid;
    return `${amani.name} ana deni la ${fmtTZS(bal)} (lipa kwa namba ${amani.controlNo} kabla ya ${amani.dueDate}). ${neema.name} amelipa ada yote ✓`;
  }
  if (/(mahudhurio|attendance|hudhuri|absent)/.test(s)) {
    return `Wiki 4 zilizopita: ${amani.name} amehudhuria ${amani.attendanceRate}% ya siku, ${neema.name} ${neema.attendanceRate}%.`;
  }
  if (/(matokeo|result|mtihani|exam|grade|ripoti)/.test(s)) {
    return `Mtihani wa Muhula 1: ${amani.name} — wastani ${amani.average}%, nafasi ya ${amani.position}/${amani.classSize}. ${neema.name} — wastani ${neema.average}%, nafasi ya ${neema.position} 🎉`;
  }
  if (/(ratiba|timetable|saa)/.test(s)) {
    return 'Shule huanza saa 1:30 asubuhi (07:30) na kuisha saa 8:00 mchana (14:00). Ratiba kamili ya mitihani ya kati: 22–25 Juni.';
  }
  return 'Samahani, swali hili nitalipeleka kwa ofisi ya shule — watakujibu hivi karibuni. Unaweza pia kuuliza kuhusu ada, mahudhurio, matokeo au ratiba.';
}

const SUGGESTIONS = ['Nina deni gani?', 'Mahudhurio ya watoto?', 'Matokeo ya mtihani?', 'Ratiba ya shule?'];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const send = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q) return;
    setMessages((m) => [...m, { role: 'user', text: q }, { role: 'assistant', text: answer(q) }]);
    setInput('');
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  return (
    <Shell title="Msaidizi / Assistant">
      <div className="flex min-h-[60vh] flex-col">
        {messages.length === 0 && (
          <div className="my-8 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-[#1a56db]" />
            <p className="mt-2 text-sm font-semibold">Uliza chochote kuhusu watoto wako</p>
            <p className="text-xs text-neutral-500">Majibu yanatoka kwenye rekodi za watoto WAKO tu — faragha kamili.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border bg-white px-3 py-1.5 text-xs shadow-sm">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex-1 space-y-2">
          {messages.map((m, i) => (
            <div key={i} className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === 'user' ? 'ml-auto rounded-br-sm bg-[#1a56db] text-white' : 'mr-auto rounded-bl-sm border bg-white shadow-sm'}`}>
              {m.text}
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="sticky bottom-20 mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Andika swali lako…"
            className="flex-1 rounded-full border bg-white px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
          />
          <button onClick={() => send()} className="rounded-full bg-[#1a56db] p-3 text-white shadow-sm">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Shell>
  );
}
