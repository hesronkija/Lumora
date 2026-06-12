'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { students, SUBJECTS } from '@/lib/demo-data';
import { Barcode } from '@/components/barcode';
import { ArrowLeft, Printer } from 'lucide-react';

/**
 * Print-ready report card (A4). The print button produces exactly what the
 * school hands to parents — crest, results, positions, teacher comments,
 * grading key and a barcode for re-verification at the office.
 */
export default function ReportCardPage() {
  const params = useParams<{ id: string }>();
  const student = students.find((s) => s.id === params.id);
  if (!student) return <p className="p-8 text-sm">Student not found.</p>;
  const idx = students.indexOf(student);
  const k = idx % 12, c = Math.floor(idx / 12);
  const rows = SUBJECTS.map((s, i) => {
    const score = 38 + ((k * 17 + i * 13 + c * 7) % 58);
    const grade = score >= 81 ? 'A' : score >= 61 ? 'B' : score >= 41 ? 'C' : 'D';
    const remark = score >= 81 ? 'Excellent / Bora sana' : score >= 61 ? 'Good / Vizuri' : score >= 41 ? 'Fair / Wastani' : 'Needs support / Anahitaji msaada';
    return { subject: s.name, score, grade, remark };
  });
  const avg = student.average;
  const comment = avg >= 75
    ? 'An excellent term. Keep up the same discipline and curiosity. / Muhula bora. Endelea na bidii ileile.'
    : avg >= 55
      ? 'A solid term with room to grow. Consistent revision will lift the next result. / Muhula mzuri; marudio ya mara kwa mara yataboresha matokeo.'
      : 'This term needs follow-up at home and school together. / Muhula huu unahitaji ufuatiliaji wa pamoja nyumbani na shuleni.';

  return (
    <div className="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between px-4 print:hidden">
        <Link href={`/students/${student.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to profile
        </Link>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          <Printer className="h-4 w-4" /> Print report card
        </button>
      </div>

      <div className="mx-auto max-w-3xl bg-white p-10 text-black shadow-lg print:max-w-none print:shadow-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b-4 border-double border-black pb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-black text-2xl font-black">GV</div>
          <div className="text-center">
            <h1 className="text-xl font-black uppercase tracking-wide">Green Valley Primary School</h1>
            <p className="text-xs">P.O. Box 12345, Msasani, Kinondoni — Dar es Salaam · Reg. PS/DAR/2024/001</p>
            <p className="mt-1 text-sm font-bold uppercase">Student Progress Report — Taarifa ya Maendeleo</p>
            <p className="text-xs">End of Term 1 · Academic Year 2025/2026</p>
          </div>
          <div className="text-black"><Barcode value={student.admissionNo.replace(/\//g, '-')} height={42} /></div>
        </div>

        {/* Student info */}
        <div className="mt-4 grid grid-cols-4 gap-y-1 border border-black p-3 text-sm">
          <span className="font-bold">Name / Jina:</span><span className="col-span-3">{student.name}</span>
          <span className="font-bold">Adm. No:</span><span>{student.admissionNo}</span>
          <span className="font-bold">Class / Darasa:</span><span>{student.klass}</span>
          <span className="font-bold">Position / Nafasi:</span><span>{student.position} of {student.classSize}</span>
          <span className="font-bold">Average / Wastani:</span><span>{avg}%</span>
          <span className="font-bold">Attendance:</span><span className="col-span-3">{student.attendanceRate}% (last 4 weeks)</span>
        </div>

        {/* Results table */}
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-black text-white">
              <th className="border border-black px-3 py-1.5 text-left">Subject / Somo</th>
              <th className="border border-black px-3 py-1.5">Marks /100</th>
              <th className="border border-black px-3 py-1.5">Grade</th>
              <th className="border border-black px-3 py-1.5 text-left">Remark / Maoni</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.subject} className="even:bg-neutral-100">
                <td className="border border-black px-3 py-1.5 font-medium">{r.subject}</td>
                <td className="border border-black px-3 py-1.5 text-center font-bold">{r.score}</td>
                <td className="border border-black px-3 py-1.5 text-center font-bold">{r.grade}</td>
                <td className="border border-black px-3 py-1.5 text-xs">{r.remark}</td>
              </tr>
            ))}
            <tr className="bg-neutral-200 font-black">
              <td className="border border-black px-3 py-1.5">AVERAGE / WASTANI</td>
              <td className="border border-black px-3 py-1.5 text-center">{avg}%</td>
              <td className="border border-black px-3 py-1.5 text-center">{avg >= 81 ? 'A' : avg >= 61 ? 'B' : avg >= 41 ? 'C' : 'D'}</td>
              <td className="border border-black px-3 py-1.5 text-xs">Position {student.position} / {student.classSize}</td>
            </tr>
          </tbody>
        </table>

        {/* Grading key */}
        <p className="mt-2 text-[11px]">Grading: A = 81–100 (Bora sana) · B = 61–80 (Vizuri) · C = 41–60 (Wastani) · D = 21–40 (Hafifu) · E = 0–20</p>

        {/* Comments */}
        <div className="mt-4 space-y-3 text-sm">
          <div className="border border-black p-3">
            <p className="text-xs font-bold uppercase">Class Teacher's Comment / Maoni ya Mwalimu wa Darasa</p>
            <p className="mt-1">{comment}</p>
            <p className="mt-3 text-xs">Signature: ______________________ Date: ____________</p>
          </div>
          <div className="border border-black p-3">
            <p className="text-xs font-bold uppercase">Headteacher's Comment / Maoni ya Mwalimu Mkuu</p>
            <p className="mt-1">{avg >= 60 ? 'Congratulations — keep aiming higher. / Hongera — endelea kulenga juu zaidi.' : 'We will support this student closely next term. / Tutamsaidia mwanafunzi huyu kwa karibu muhula ujao.'}</p>
            <p className="mt-3 text-xs">Signature: ______________________ Official stamp: ____________</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-black pt-2 text-[10px]">
          <span>Next term begins: 07 Sep 2026 · Fees due before opening day</span>
          <span>Generated by Lumora · verify at office with barcode</span>
        </div>
      </div>
    </div>
  );
}
