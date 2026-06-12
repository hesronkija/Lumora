'use client';

import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Card, CardHeader, Button, Badge } from '@/components/ui/primitives';
import { useI18n } from '@/lib/i18n';
import { students, SUBJECTS } from '@/lib/demo-data';
import { useState } from 'react';
import { Sparkles, Send, MessageSquareText, Megaphone } from 'lucide-react';

/**
 * AI workbench — mirrors the API's /ai endpoints. In demo mode the same
 * deterministic engines run client-side; with a backend + vLLM gateway the
 * drafts come from the in-region LLM. Every draft requires human approval.
 */

type Msg = { role: 'user' | 'assistant'; text: string };

function chatAnswer(q: string, lang: 'en' | 'sw'): string {
  const s = q.toLowerCase();
  const child = students[5]!; // demo parent's child
  if (/(fee|ada|balance|deni|lipa|karo)/.test(s)) {
    const bal = (child.due - child.paid).toLocaleString();
    return lang === 'sw'
      ? `${child.name} ana deni la ada la TZS ${bal}. Unaweza kulipa kwa M-Pesa kwa kutumia namba ya malipo.`
      : `${child.name} has an outstanding fee balance of TZS ${bal}. You can pay via M-Pesa using the control number.`;
  }
  if (/(attendance|mahudhurio|absent|hudhuri)/.test(s)) {
    return lang === 'sw'
      ? `${child.name} amehudhuria ${child.attendanceRate}% ya siku za shule katika wiki 4 zilizopita.`
      : `${child.name} attended ${child.attendanceRate}% of school days in the last 4 weeks.`;
  }
  if (/(grade|matokeo|result|exam|mtihani|ripoti)/.test(s)) {
    return lang === 'sw'
      ? `${child.name} alipata wastani wa ${child.average}% muhula uliopita, nafasi ya ${child.position} kati ya ${child.classSize}.`
      : `${child.name} averaged ${child.average}% last term, position ${child.position} of ${child.classSize}.`;
  }
  return lang === 'sw'
    ? 'Nitapeleka swali lako kwa ofisi ya shule — watakujibu hivi karibuni.'
    : 'I will forward your question to the school office — they will reply shortly.';
}

function draftComment(studentIdx: number, subjectIdx: number, lang: 'en' | 'sw'): string {
  const st = students[studentIdx]!;
  const k = studentIdx % 12, c = Math.floor(studentIdx / 12);
  const pct = 38 + ((k * 17 + subjectIdx * 13 + c * 7) % 58);
  const subj = SUBJECTS[subjectIdx]!.name;
  const band = pct >= 80 ? 'excellent' : pct >= 65 ? 'good' : pct >= 50 ? 'average' : pct >= 35 ? 'below' : 'poor';
  const en: Record<string, string> = {
    excellent: `Outstanding work in ${subj} this term (${pct}%). Keep up the same discipline and curiosity.`,
    good: `A solid performance in ${subj} (${pct}%). With steady revision, the top band is within reach.`,
    average: `A fair result in ${subj} (${pct}%). More consistent practice will lift the next result.`,
    below: `${subj} needs closer attention this coming term (${pct}%). Extra practice at home will help.`,
    poor: `A difficult term in ${subj} (${pct}%). A guided study plan and regular follow-up between home and school is recommended.`,
  };
  const sw: Record<string, string> = {
    excellent: `Amefanya vizuri sana katika ${subj} muhula huu (${pct}%). Aendelee na bidii ileile.`,
    good: `Matokeo mazuri katika ${subj} (${pct}%). Kwa marudio ya mara kwa mara anaweza kufika daraja la juu.`,
    average: `Matokeo ya wastani katika ${subj} (${pct}%). Mazoezi zaidi yatainua matokeo yajayo.`,
    below: `Anahitaji msaada zaidi katika ${subj} muhula ujao (${pct}%). Mazoezi ya nyumbani yatasaidia.`,
    poor: `Muhula mgumu katika ${subj} (${pct}%). Tunapendekeza mpango wa masomo ya ziada na ufuatiliaji wa karibu.`,
  };
  return (lang === 'sw' ? sw : en)[band]!;
}

export default function AiPage() {
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [studentIdx, setStudentIdx] = useState(0);
  const [subjectIdx, setSubjectIdx] = useState(2);
  const [comment, setComment] = useState('');
  const [intent, setIntent] = useState('Remind parents that Term 2 fees are due by Friday 19 June');
  const [announcement, setAnnouncement] = useState('');

  const send = () => {
    if (!input.trim()) return;
    const q = input.trim();
    setMessages((m) => [...m, { role: 'user', text: q }, { role: 'assistant', text: chatAnswer(q, lang) }]);
    setInput('');
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={t('ai')}
          subtitle="Local-first AI: works offline with the deterministic engine, upgrades to an in-region LLM (vLLM, PII-scrubbed) when configured. Humans approve everything."
        />

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Parent assistant */}
          <Card className="flex flex-col lg:row-span-2">
            <CardHeader title={t('parentAssistant')} subtitle="Bilingual · grounded ONLY in the asking parent's children" action={<MessageSquareText className="h-4 w-4 text-muted-foreground" />} />
            <div className="flex max-h-[420px] min-h-[280px] flex-1 flex-col gap-2 overflow-y-auto p-4">
              {messages.length === 0 && (
                <div className="m-auto space-y-2 text-center text-xs text-muted-foreground">
                  <Sparkles className="mx-auto h-5 w-5" />
                  <p>"Nina deni gani la ada?" · "How is attendance?"<br />"Matokeo ya mtihani?"</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${m.role === 'user' ? 'self-end bg-primary text-primary-foreground' : 'self-start bg-muted'}`}>
                  {m.text}
                </div>
              ))}
            </div>
            <div className="flex gap-2 border-t p-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder={t('askPlaceholder')}
                className="flex-1 rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button onClick={send}><Send className="h-3.5 w-3.5" /></Button>
            </div>
          </Card>

          {/* Report comment drafter */}
          <Card className="lg:col-span-2">
            <CardHeader title={t('draftComment')} subtitle="Teacher edits and approves before it reaches the report card" action={<Badge tone="violet">A1</Badge>} />
            <div className="space-y-3 p-5">
              <div className="flex flex-wrap gap-2">
                <select value={studentIdx} onChange={(e) => setStudentIdx(Number(e.target.value))}
                  className="rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  {students.slice(0, 24).map((s, i) => <option key={s.id} value={i}>{s.name} — {s.klass}</option>)}
                </select>
                <select value={subjectIdx} onChange={(e) => setSubjectIdx(Number(e.target.value))}
                  className="rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  {SUBJECTS.map((s, i) => <option key={s.code} value={i}>{s.name}</option>)}
                </select>
                <Button onClick={() => setComment(draftComment(studentIdx, subjectIdx, lang))}>
                  <Sparkles className="h-3.5 w-3.5" /> Draft
                </Button>
              </div>
              {comment && (
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border bg-muted/30 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              )}
              {comment && <p className="text-xs text-muted-foreground">Draft only — edit freely, then approve into the report card.</p>}
            </div>
          </Card>

          {/* Announcement drafter */}
          <Card className="lg:col-span-2">
            <CardHeader title={t('draftAnnouncement')} subtitle="SMS ≤160 chars · never auto-sent" action={<Megaphone className="h-4 w-4 text-muted-foreground" />} />
            <div className="space-y-3 p-5">
              <div className="flex flex-wrap gap-2">
                <input
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  className="min-w-[280px] flex-1 rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <Button onClick={() => setAnnouncement(
                  lang === 'sw'
                    ? `Ndugu Mzazi/Mlezi, ${intent.trim()}. Asante. — Green Valley Primary`
                    : `Dear Parent/Guardian, ${intent.trim()}. Thank you. — Green Valley Primary`,
                )}>
                  <Sparkles className="h-3.5 w-3.5" /> Draft
                </Button>
              </div>
              {announcement && (
                <div className="space-y-2">
                  <textarea
                    value={announcement}
                    onChange={(e) => setAnnouncement(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border bg-muted/30 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${announcement.length > 160 ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {announcement.length}/160 SMS characters
                    </span>
                    <Button variant="outline">Send via Comms →</Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
