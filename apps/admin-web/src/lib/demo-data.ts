/**
 * Demo dataset — mirrors apps/api seed 002 (Green Valley Primary School).
 * Drives the UI when no API is configured (NEXT_PUBLIC_API_URL unset), so
 * the whole system is explorable with `pnpm dev` and zero backend.
 */

const FIRST_M = ['Amani', 'Baraka', 'Daudi', 'Emmanuel', 'Frank', 'Godfrey', 'Hamisi', 'Ibrahim', 'Juma', 'Kelvin', 'Lukas', 'Musa'];
const FIRST_F = ['Anna', 'Bahati', 'Catherine', 'Dorcas', 'Esther', 'Fatuma', 'Grace', 'Halima', 'Irene', 'Joyce', 'Neema', 'Zawadi'];
const LAST = ['Mushi', 'Massawe', 'Kimaro', 'Mwakyusa', 'Shayo', 'Komba', 'Temba', 'Mlay', 'Swai', 'Lyimo', 'Macha', 'Urassa'];

export const SUBJECTS = [
  { code: 'KIS', name: 'Kiswahili' }, { code: 'ENG', name: 'English' },
  { code: 'MATH', name: 'Mathematics' }, { code: 'SCI', name: 'Science & Technology' },
  { code: 'SOC', name: 'Social Studies' }, { code: 'CME', name: 'Civics & Moral Education' },
  { code: 'REL', name: 'Religion' }, { code: 'VS', name: 'Vocational Skills' },
];

export interface Student {
  id: string; admissionNo: string; name: string; gender: 'male' | 'female';
  klass: string; guardian: string; guardianPhone: string; dob: string;
  feeStatus: 'paid' | 'partial' | 'issued'; paid: number; due: number;
  attendanceRate: number; average: number; position: number; classSize: number;
}

export interface StaffMember {
  id: string; employeeNo: string; name: string; gender: string; position: string;
  department: string; basicSalary: number; pensionFund: string; contractType: string;
  phone: string; disbursement: string; hasHeslb: boolean; active: boolean;
}

function luhn(partial: string): number {
  const digits = partial.split('').map(Number);
  let sum = 0; let dbl = true;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i]!;
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d; dbl = !dbl;
  }
  return (10 - (sum % 10)) % 10;
}

export const students: Student[] = [];
let sn = 0;
for (let c = 0; c < 7; c++) {
  for (let k = 0; k < 12; k++) {
    sn += 1;
    const female = k % 2 === 0;
    const first = (female ? FIRST_F : FIRST_M)[(sn * 7 + k) % 12]!;
    const last = LAST[(sn * 5 + c) % 12]!;
    const bucket = (sn - 1) % 20;
    const paid = bucket < 12 ? 460000 : bucket < 17 ? 200000 : 0;
    // deterministic attendance & performance (mirror seed maths)
    let absent = 0;
    for (let d = 0; d < 20; d++) if ((c * 31 + k * 7 + d) % 25 === 0) absent++;
    let total = 0;
    for (let s = 0; s < 8; s++) total += 38 + ((k * 17 + s * 13 + c * 7) % 58);
    students.push({
      id: `s-${sn}`, admissionNo: `GV/2026/${sn.toString().padStart(4, '0')}`,
      name: `${first} ${last}`, gender: female ? 'female' : 'male',
      klass: `Std ${c + 1} A`, guardian: `Mzazi ${last}`,
      guardianPhone: `+2557${(20000000 + sn * 13).toString()}`,
      dob: `${2019 - c}-0${(k % 9) + 1}-1${k % 3}`,
      feeStatus: paid >= 460000 ? 'paid' : paid > 0 ? 'partial' : 'issued',
      paid, due: 460000, attendanceRate: Math.round(((20 - absent) / 20) * 100),
      average: Math.round((total / 8) * 10) / 10, position: 0, classSize: 12,
    });
  }
}
// class positions
for (let c = 0; c < 7; c++) {
  const cls = students.slice(c * 12, c * 12 + 12).sort((a, b) => b.average - a.average);
  cls.forEach((s, i) => { s.position = i + 1; });
}

export const staff: StaffMember[] = ([
  ['Upendo Mahenge', 'female', 'Headteacher', 'Administration', 1450000],
  ['Joseph Kileo', 'male', 'Bursar', 'Finance', 1100000],
  ['Rehema Senzige', 'female', 'Accountant', 'Finance', 950000],
  ['Elia Mrema', 'male', 'Teacher', 'Academics', 820000],
  ['Mariam Kondo', 'female', 'Teacher', 'Academics', 800000],
  ['Peter Mselle', 'male', 'Teacher', 'Academics', 780000],
  ['Agnes Mallya', 'female', 'Teacher', 'Academics', 760000],
  ['Samson Nnko', 'male', 'Teacher', 'Academics', 750000],
  ['Lucy Mboya', 'female', 'Teacher', 'Academics', 740000],
  ['Hassan Mtui', 'male', 'Driver', 'Transport', 450000],
  ['Zainabu Salim', 'female', 'Matron', 'Boarding', 520000],
  ['George Minja', 'male', 'Cook', 'Catering', 380000],
] as const).map(([name, gender, position, department, basicSalary], i) => ({
  id: `st-${i + 1}`, employeeNo: `GV-${(i + 1).toString().padStart(3, '0')}`,
  name, gender, position, department, basicSalary,
  pensionFund: 'NSSF', contractType: 'Permanent',
  phone: `+2557${(10000000 + i * 111).toString()}`,
  disbursement: i < 9 ? 'Bank' : 'Mobile money', hasHeslb: i % 4 === 0, active: true,
}));

export interface Invoice {
  id: string; invoiceNo: string; student: string; klass: string; controlNo: string;
  amount: number; paid: number; status: 'paid' | 'partial' | 'issued'; dueDate: string;
}
export const invoices: Invoice[] = students.map((s, i) => {
  const body = `0001${(i + 1).toString().padStart(7, '0')}`;
  return {
    id: `inv-${i + 1}`, invoiceNo: `INV/2026/${(i + 1).toString().padStart(5, '0')}`,
    student: s.name, klass: s.klass, controlNo: `${body}${luhn(body)}`,
    amount: s.due, paid: s.paid, status: s.feeStatus, dueDate: '2026-05-15',
  };
});

export interface Payment {
  id: string; ref: string; student: string; amount: number;
  channel: string; provider: string; date: string; status: string;
}
export const payments: Payment[] = students
  .map((s, i) => ({ s, i }))
  .filter(({ s }) => s.paid > 0)
  .map(({ s, i }) => ({
    id: `pay-${i + 1}`, ref: `DEMO-${(i + 1).toString().padStart(6, '0')}`,
    student: s.name, amount: s.paid,
    channel: i % 3 === 0 ? 'Bank' : 'Mobile money',
    provider: i % 3 === 0 ? 'NMB' : 'M-Pesa (Selcom)',
    date: `2026-05-${((i % 27) + 1).toString().padStart(2, '0')}`, status: 'completed',
  }));

// ── Derived KPIs ──────────────────────────────────────────────────────────────
export const kpis = {
  students: students.length,
  staff: staff.filter((s) => s.active).length,
  collected: payments.reduce((a, p) => a + p.amount, 0),
  arrears: invoices.reduce((a, i) => a + (i.amount - i.paid), 0),
  attendanceToday: Math.round(students.reduce((a, s) => a + s.attendanceRate, 0) / students.length),
  feesCollectionRate: Math.round(
    (payments.reduce((a, p) => a + p.amount, 0) / invoices.reduce((a, i) => a + i.amount, 0)) * 100,
  ),
};

export const collectionByWeek = [
  { label: 'Wk 1', value: 6_440_000 }, { label: 'Wk 2', value: 8_120_000 },
  { label: 'Wk 3', value: 5_980_000 }, { label: 'Wk 4', value: 7_660_000 },
  { label: 'Wk 5', value: 4_900_000 }, { label: 'Wk 6', value: 3_840_000 },
];

export const attendanceByClass = Array.from({ length: 7 }, (_, c) => {
  const cls = students.slice(c * 12, c * 12 + 12);
  return {
    label: `Std ${c + 1}`,
    value: Math.round(cls.reduce((a, s) => a + s.attendanceRate, 0) / cls.length),
  };
});

export const channelMix = [
  { label: 'Mobile money', value: payments.filter((p) => p.channel === 'Mobile money').reduce((a, p) => a + p.amount, 0) },
  { label: 'Bank', value: payments.filter((p) => p.channel === 'Bank').reduce((a, p) => a + p.amount, 0) },
];

export const atRisk = students
  .map((s) => {
    const attendanceRisk = (100 - s.attendanceRate) / 100;
    const gradeRisk = Math.max(0, Math.min(1, (50 - s.average) / 50));
    const arrearsRisk = s.feeStatus === 'issued' ? 1 : s.feeStatus === 'partial' ? 0.5 : 0;
    const score = attendanceRisk * 0.45 + gradeRisk * 0.35 + arrearsRisk * 0.2;
    const signals: string[] = [];
    if (s.attendanceRate < 88) signals.push(`Attendance ${s.attendanceRate}%`);
    if (s.average < 50) signals.push(`Average ${s.average}%`);
    if (s.feeStatus !== 'paid') signals.push('Fee arrears');
    return { ...s, score: Math.round(score * 100) / 100, signals };
  })
  .filter((s) => s.score >= 0.18 && s.signals.length > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, 12);

// ── Payroll (computed with Finance Act 2024 maths) ───────────────────────────
function paye(gross: number): number {
  const b = [
    [0, 270000, 0], [270000, 520000, 0.08], [520000, 760000, 0.2],
    [760000, 1000000, 0.25], [1000000, Infinity, 0.3],
  ] as const;
  let tax = 0;
  for (const [from, to, rate] of b) {
    if (gross <= from) break;
    tax += (Math.min(gross, to) - from) * rate;
  }
  return Math.round(tax);
}
export const payslips = staff.map((s) => {
  const gross = s.basicSalary + (s.position === 'Headteacher' ? 200000 : 0);
  const tax = paye(gross);
  const nssf = Math.round(gross * 0.1);
  const heslb = s.hasHeslb ? Math.round(s.basicSalary * 0.15) : 0;
  const deductions = tax + nssf + heslb;
  return {
    id: `ps-${s.id}`, name: s.name, position: s.position, gross,
    paye: tax, nssf, heslb, deductions, net: gross - deductions,
    sdl: Math.round(gross * 0.035), wcf: Math.round(gross * 0.006),
  };
});
export const payrollTotals = payslips.reduce(
  (a, p) => ({
    gross: a.gross + p.gross, paye: a.paye + p.paye, nssf: a.nssf + p.nssf,
    net: a.net + p.net, employer: a.employer + p.nssf + p.sdl + p.wcf,
  }),
  { gross: 0, paye: 0, nssf: 0, net: 0, employer: 0 },
);

// ── Accounting ────────────────────────────────────────────────────────────────
export const accounts = [
  { code: '1000', name: 'Cash & Bank', type: 'Asset', balance: kpis.collected - payrollTotals.net - 4_200_000 },
  { code: '1100', name: 'Accounts Receivable (Fees)', type: 'Asset', balance: kpis.arrears },
  { code: '2000', name: 'Accounts Payable', type: 'Liability', balance: 1_850_000 },
  { code: '2100', name: 'Statutory Liabilities (PAYE/NSSF)', type: 'Liability', balance: payrollTotals.paye + payrollTotals.nssf },
  { code: '4000', name: 'Fee Income', type: 'Income', balance: invoices.reduce((a, i) => a + i.amount, 0) },
  { code: '5000', name: 'Salaries & Wages', type: 'Expense', balance: payrollTotals.gross },
  { code: '5100', name: 'Utilities & Supplies', type: 'Expense', balance: 2_350_000 },
  { code: '5200', name: 'Transport Fuel & Maintenance', type: 'Expense', balance: 1_850_000 },
];
export const journal = [
  { no: 'JE/2026/00041', date: '2026-06-01', narrative: 'May payroll posting', source: 'payroll', dr: payrollTotals.gross, cr: payrollTotals.gross },
  { no: 'JE/2026/00040', date: '2026-05-30', narrative: 'Fee receipts — week 4 banking', source: 'payments', dr: 7660000, cr: 7660000 },
  { no: 'JE/2026/00039', date: '2026-05-28', narrative: 'TANESCO + DAWASA utilities', source: 'manual', dr: 480000, cr: 480000 },
  { no: 'JE/2026/00038', date: '2026-05-25', narrative: 'Bus fuel — route Msasani', source: 'manual', dr: 260000, cr: 260000 },
  { no: 'JE/2026/00037', date: '2026-05-23', narrative: 'Fee receipts — week 3 banking', source: 'payments', dr: 5980000, cr: 5980000 },
];

// ── Boarding / transport / comms ─────────────────────────────────────────────
export const dorms = [
  { name: 'Kilimanjaro House', gender: 'Boys', capacity: 40, occupied: 34, matron: 'Samson Nnko' },
  { name: 'Serengeti House', gender: 'Girls', capacity: 40, occupied: 38, matron: 'Zainabu Salim' },
];
export const routes = [
  { name: 'Route 1 — Msasani', driver: 'Hassan Mtui', bus: 'T 456 DFK', students: 28, pickups: 6 },
  { name: 'Route 2 — Mikocheni', driver: 'Hassan Mtui', bus: 'T 789 EBL', students: 22, pickups: 5 },
];
export const messagesLog = [
  { date: '2026-06-10', channel: 'SMS', to: 84, template: 'Fee reminder — Term 2 balance', cost: 2100, status: 'delivered' },
  { date: '2026-06-08', channel: 'WhatsApp', to: 78, template: 'Mid-term exam timetable', cost: 0, status: 'delivered' },
  { date: '2026-06-02', channel: 'SMS', to: 84, template: 'School reopens Monday', cost: 2100, status: 'delivered' },
];

export const admissionsPipeline = [
  { stage: 'applied', count: 36 }, { stage: 'interviewed', count: 24 },
  { stage: 'offered', count: 18 }, { stage: 'enrolled', count: 12 },
];

export const applications = Array.from({ length: 9 }, (_, i) => ({
  id: `app-${i + 1}`, ref: `APP/2026/${(i + 1).toString().padStart(3, '0')}`,
  name: `${(i % 2 ? FIRST_M : FIRST_F)[(i * 5) % 12]} ${LAST[(i * 7) % 12]}`,
  appliedFor: `Std ${(i % 7) + 1}`, guardianPhone: `+2557${(30000000 + i * 17).toString()}`,
  date: `2026-0${(i % 5) + 1}-1${i % 3}`,
  stage: (['applied', 'applied', 'interviewed', 'interviewed', 'offered', 'offered', 'enrolled', 'applied', 'interviewed'] as const)[i]!,
}));

export const fmtTZS = (n: number) => `TZS ${n.toLocaleString('en-US')}`;
export const fmtTZSshort = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1000)}k` : String(n);
