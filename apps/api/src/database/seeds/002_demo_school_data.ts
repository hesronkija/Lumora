import type { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';

/**
 * Rich demo dataset — a living Tanzanian primary school.
 *
 * Green Valley Primary School (Dar es Salaam): 2025/2026 academic year,
 * 3 terms, Std 1–7 with A streams, 8 subjects, 12 staff, 84 students with
 * guardians, fee structures + invoices + payments, 4 weeks of attendance,
 * end-of-term exams with scores and ranked report cards, plus the
 * statutory payroll rates from the Finance Act 2024 / contribution orders.
 *
 * Idempotent: deterministic UUIDs derived from a namespace counter.
 */

const T = '00000000-0000-0000-0000-000000000001'; // demo tenant id (seed 001)
const ADMIN = '00000000-0000-0000-0000-000000000002';

// Deterministic ids: stable across re-runs
function did(n: number): string {
  return `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
}

const FIRST_M = ['Amani', 'Baraka', 'Daudi', 'Emmanuel', 'Frank', 'Godfrey', 'Hamisi', 'Ibrahim', 'Juma', 'Kelvin', 'Lukas', 'Musa'];
const FIRST_F = ['Anna', 'Bahati', 'Catherine', 'Dorcas', 'Esther', 'Fatuma', 'Grace', 'Halima', 'Irene', 'Joyce', 'Neema', 'Zawadi'];
const LAST = ['Mushi', 'Massawe', 'Kimaro', 'Mwakyusa', 'Shayo', 'Komba', 'Temba', 'Mlay', 'Swai', 'Lyimo', 'Macha', 'Urassa'];

const SUBJECTS = [
  { code: 'KIS', name: 'Kiswahili' }, { code: 'ENG', name: 'English' },
  { code: 'MATH', name: 'Mathematics' }, { code: 'SCI', name: 'Science & Technology' },
  { code: 'SOC', name: 'Social Studies' }, { code: 'CME', name: 'Civics & Moral Education' },
  { code: 'REL', name: 'Religion' }, { code: 'VS', name: 'Vocational Skills' },
];

export async function seed(db: Knex): Promise<void> {
  // Completeness check: report cards are the LAST thing this seed writes,
  // so their presence means the whole dataset is in place.
  const done = await db('report_card').where({ tenant_id: T }).first();
  if (done) return;

  // A partial earlier run leaves orphans — clear and rebuild atomically.
  await db.transaction(async (knex) => {
  await knex('payment').del();
  await knex('statutory_rate').del();
  await knex('academic_year').where({ tenant_id: T }).del(); // cascades terms/classes/invoices…
  await knex('subject').where({ tenant_id: T }).del();
  await knex('student_guardian').where({ tenant_id: T }).del();
  await knex('guardian').where({ tenant_id: T }).del();
  await knex('student').where({ tenant_id: T }).del();
  await knex('staff').where({ tenant_id: T }).del();

  // ── Statutory payroll rates (Finance Act 2024 + contribution orders) ───────
  const rates = [
    ['paye_bracket', JSON.stringify([
      { from: 0, to: 270000, rate: 0 },
      { from: 270000, to: 520000, rate: 0.08 },
      { from: 520000, to: 760000, rate: 0.2 },
      { from: 760000, to: 1000000, rate: 0.25 },
      { from: 1000000, to: null, rate: 0.3 },
    ]), 'Finance Act 2024 — resident monthly PAYE'],
    ['nssf_employee', JSON.stringify({ rate: 0.1 }), 'NSSF Act — 10% employee'],
    ['nssf_employer', JSON.stringify({ rate: 0.1 }), 'NSSF Act — 10% employer'],
    ['psssf_employee', JSON.stringify({ rate: 0.05 }), 'PSSSF Act — 5% employee'],
    ['psssf_employer', JSON.stringify({ rate: 0.15 }), 'PSSSF Act — 15% employer'],
    ['wcf', JSON.stringify({ rate: 0.006 }), 'WCF Order — 0.6% private employers'],
    ['sdl', JSON.stringify({ rate: 0.035, min_employees: 10 }), 'SDL — 3.5%, ≥10 employees'],
    ['heslb', JSON.stringify({ rate: 0.15, basis: 'basic' }), 'HESLB Act — 15% of basic'],
    ['nhif', JSON.stringify({ rate: 0.03 }), 'NHIF (pre-UHI, dormant)'],
  ] as const;
  for (const [rateType, config, source] of rates) {
    await knex('statutory_rate').insert({
      id: uuidv4(), rate_type: rateType, effective_from: '2024-07-01', config, source,
    });
  }

  // ── Academic year, terms ────────────────────────────────────────────────────
  const yearId = did(1);
  await knex('academic_year').insert({
    id: yearId, tenant_id: T, label: '2025/2026',
    start_date: '2026-01-12', end_date: '2026-12-04', is_current: true,
  });
  const terms = [
    { id: did(2), n: 1, start: '2026-01-12', end: '2026-03-27', current: false },
    { id: did(3), n: 2, start: '2026-04-20', end: '2026-06-26', current: true },
    { id: did(4), n: 3, start: '2026-09-07', end: '2026-12-04', current: false },
  ];
  for (const t of terms) {
    await knex('term').insert({
      id: t.id, tenant_id: T, academic_year_id: yearId, term_number: t.n,
      start_date: t.start, end_date: t.end, is_current: t.current,
    });
  }
  const TERM1 = did(2), TERM2 = did(3);

  // ── Subjects ────────────────────────────────────────────────────────────────
  const subjectIds: string[] = [];
  SUBJECTS.forEach((s, i) => subjectIds.push(did(10 + i)));
  for (let i = 0; i < SUBJECTS.length; i++) {
    await knex('subject').insert({
      id: subjectIds[i], tenant_id: T, code: SUBJECTS[i]!.code, name: SUBJECTS[i]!.name,
      level_range: 'Std1-Std7', is_core: i < 5,
    });
  }

  // ── Classes Std 1–7 ─────────────────────────────────────────────────────────
  const classIds: string[] = [];
  for (let std = 1; std <= 7; std++) {
    const id = did(30 + std);
    classIds.push(id);
    await knex('class').insert({
      id, tenant_id: T, academic_year_id: yearId, level: `Std ${std}`, stream: 'A', capacity: 45,
    });
  }

  // ── Staff (12) ──────────────────────────────────────────────────────────────
  const staffDefs = [
    ['Upendo Mahenge', 'female', 'Headteacher', 'Administration', '1450000'],
    ['Joseph Kileo', 'male', 'Bursar', 'Finance', '1100000'],
    ['Rehema Senzige', 'female', 'Accountant', 'Finance', '950000'],
    ['Elia Mrema', 'male', 'Teacher', 'Academics', '820000'],
    ['Mariam Kondo', 'female', 'Teacher', 'Academics', '800000'],
    ['Peter Mselle', 'male', 'Teacher', 'Academics', '780000'],
    ['Agnes Mallya', 'female', 'Teacher', 'Academics', '760000'],
    ['Samson Nnko', 'male', 'Teacher', 'Academics', '750000'],
    ['Lucy Mboya', 'female', 'Teacher', 'Academics', '740000'],
    ['Hassan Mtui', 'male', 'Driver', 'Transport', '450000'],
    ['Zainabu Salim', 'female', 'Matron', 'Boarding', '520000'],
    ['George Minja', 'male', 'Cook', 'Catering', '380000'],
  ] as const;
  for (let i = 0; i < staffDefs.length; i++) {
    const [name, gender, position, dept, salary] = staffDefs[i]!;
    await knex('staff').insert({
      id: did(50 + i), tenant_id: T, employee_no: `GV-${(i + 1).toString().padStart(3, '0')}`,
      legal_name: name, gender, position, department: dept,
      basic_salary: salary, pension_fund: 'nssf', contract_type: 'permanent',
      has_heslb_loan: i % 4 === 0, disbursement_method: i < 9 ? 'bank' : 'mobile_money',
      phone: `+2557${(10000000 + i * 111).toString()}`, employment_start: '2024-01-08',
      allowances: JSON.stringify(i === 0 ? [{ code: 'RESP', label: 'Responsibility Allowance', amount: '200000' }] : []),
      active: true,
    });
  }

  // ── Students (12 per class × 7), guardians, enrollments ────────────────────
  let sn = 0;
  const studentIds: string[] = [];
  for (let c = 0; c < 7; c++) {
    for (let k = 0; k < 12; k++) {
      sn += 1;
      const female = k % 2 === 0;
      const first = (female ? FIRST_F : FIRST_M)[(sn * 7 + k) % 12]!;
      const last = LAST[(sn * 5 + c) % 12]!;
      const sid = did(100 + sn);
      studentIds.push(sid);
      const birthYear = 2019 - c;
      await knex('student').insert({
        id: sid, tenant_id: T, admission_no: `GV/2026/${sn.toString().padStart(4, '0')}`,
        legal_name: `${first} ${last}`, gender: female ? 'female' : 'male',
        dob: `${birthYear}-0${(k % 9) + 1}-1${k % 3}`, nationality: 'Tanzanian', active: true,
      });
      // guardian (one per student; every 3rd shares a phone-style parent account)
      const gid = did(400 + sn);
      await knex('guardian').insert({
        id: gid, tenant_id: T, legal_name: `Mzazi ${last}`,
        phone: `+2557${(20000000 + sn * 13).toString()}`,
        relation: k % 2 === 0 ? 'mother' : 'father', occupation: 'Mfanyabiashara',
      });
      await knex('student_guardian').insert({
        id: did(700 + sn), tenant_id: T, student_id: sid, guardian_id: gid,
        is_primary: true, can_pickup: true, fin_responsible: true,
      });
      for (const termId of [TERM1, TERM2]) {
        await knex('enrollment').insert({
          id: uuidv4(), tenant_id: T, student_id: sid, class_id: classIds[c],
          term_id: termId, status: 'active',
        });
      }
    }
  }

  // ── Fees: structure + invoices (term 2) ────────────────────────────────────
  const feeItems = [
    { code: 'TUITION', label: 'Tuition Fee', amount: '350000.0000', mandatory: true },
    { code: 'MEALS', label: 'Meals', amount: '90000.0000', mandatory: true },
    { code: 'EXAM', label: 'Examination Fee', amount: '20000.0000', mandatory: true },
  ];
  const fsId = did(900);
  await knex('fee_structure').insert({
    id: fsId, tenant_id: T, term_id: TERM2, name: 'Day Scholar — Term 2 2026',
    student_type: 'all', items: JSON.stringify(feeItems), total_amount: '460000.0000', active: true,
  });

  const luhn = (partial: string): number => {
    const digits = partial.split('').map(Number);
    let sum = 0; let dbl = true;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = digits[i]!;
      if (dbl) { d *= 2; if (d > 9) d -= 9; }
      sum += d; dbl = !dbl;
    }
    return (10 - (sum % 10)) % 10;
  };
  const prefix = T.replace(/-/g, '').slice(-4);

  for (let i = 0; i < studentIds.length; i++) {
    const body = `${prefix.padStart(4, '0')}${(i + 1).toString().padStart(7, '0')}`;
    const controlNo = `${body}${luhn(body)}`;
    // 60% fully paid, 25% partial, 15% unpaid
    const bucket = i % 20;
    const paid = bucket < 12 ? 460000 : bucket < 17 ? 200000 : 0;
    const status = paid >= 460000 ? 'paid' : paid > 0 ? 'partial' : 'issued';
    const invId = did(1100 + i);
    await knex('invoice').insert({
      id: invId, tenant_id: T, student_id: studentIds[i], term_id: TERM2,
      invoice_no: `INV/2026/${(i + 1).toString().padStart(5, '0')}`,
      items: JSON.stringify(feeItems), amount: '460000.0000', arrears: 0, discounts: 0,
      total_due: '460000.0000', total_paid: `${paid}.0000`, control_no: controlNo,
      status, due_date: '2026-05-15',
    });
    if (paid > 0) {
      await knex('payment').insert({
        id: did(1300 + i), tenant_id: T, invoice_id: invId, amount: `${paid}.0000`,
        channel: i % 3 === 0 ? 'bank' : 'mobile_money', provider: i % 3 === 0 ? 'nmb' : 'selcom',
        provider_ref: `DEMO-${(i + 1).toString().padStart(6, '0')}`,
        idempotency_key: `demo-pay-${i + 1}`, status: 'completed',
        paid_at: `2026-05-${(i % 27 + 1).toString().padStart(2, '0')}`,
      });
    }
  }

  // ── Attendance: 20 school days × 7 classes ─────────────────────────────────
  const schoolDays: string[] = [];
  for (let d = 11; schoolDays.length < 20 && d < 42; d++) {
    const date = new Date(Date.UTC(2026, 4, d)); // from 11 May
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) {
      schoolDays.push(date.toISOString().slice(0, 10));
    }
  }
  for (let c = 0; c < 7; c++) {
    for (const day of schoolDays) {
      const sessId = uuidv4();
      await knex('attendance_session').insert({
        id: sessId, tenant_id: T, class_id: classIds[c], term_id: TERM2,
        date: day, session_type: 'full_day', taken_by: ADMIN,
      });
      const rows = [];
      for (let k = 0; k < 12; k++) {
        const sid = studentIds[c * 12 + k]!;
        // pseudo-random but deterministic absence pattern (~92% present)
        const h = (c * 31 + k * 7 + Number(day.slice(-2))) % 25;
        const status = h === 0 ? 'absent' : h === 1 ? 'late' : 'present';
        rows.push({ id: uuidv4(), tenant_id: T, session_id: sessId, student_id: sid, status });
      }
      await knex('attendance_record').insert(rows);
    }
  }

  // ── Exams (end of term 1) + scores + ranked report cards ──────────────────
  for (let c = 0; c < 7; c++) {
    const examId = did(2000 + c);
    await knex('exam').insert({
      id: examId, tenant_id: T, term_id: TERM1, class_id: classIds[c],
      name: 'End of Term 1', exam_type: 'end_of_term', exam_date: '2026-03-20', total_marks: 100,
    });
    const averages: Array<{ sid: string; avg: number }> = [];
    for (let k = 0; k < 12; k++) {
      const sid = studentIds[c * 12 + k]!;
      let total = 0;
      const rows = [];
      for (let s = 0; s < SUBJECTS.length; s++) {
        const score = 38 + ((k * 17 + s * 13 + c * 7) % 58); // 38–95
        total += score;
        rows.push({
          id: uuidv4(), tenant_id: T, exam_id: examId, student_id: sid,
          subject_id: subjectIds[s], marks_obtained: score, total_marks: 100,
          grade: score >= 81 ? 'A' : score >= 61 ? 'B' : score >= 41 ? 'C' : 'D',
        });
      }
      await knex('exam_score').insert(rows);
      averages.push({ sid, avg: total / SUBJECTS.length });
    }
    averages.sort((a, b) => b.avg - a.avg);
    for (let pos = 0; pos < averages.length; pos++) {
      await knex('report_card').insert({
        id: uuidv4(), tenant_id: T, student_id: averages[pos]!.sid, term_id: TERM1,
        class_id: classIds[c], average_marks: averages[pos]!.avg.toFixed(2),
        position_in_class: pos + 1, total_students_in_class: averages.length,
        status: 'published', published_at: '2026-03-27',
      });
    }
  }
  }); // end transaction
}
