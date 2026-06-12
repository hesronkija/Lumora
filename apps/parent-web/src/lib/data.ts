/** Demo data for the parent app — Mzazi Mushi's two children at Green Valley. */

export interface Child {
  id: string; name: string; klass: string; admissionNo: string; photoInitials: string;
  feeDue: number; feePaid: number; controlNo: string; dueDate: string;
  attendanceRate: number; last5: Array<'P' | 'A' | 'L'>;
  average: number; position: number; classSize: number;
  subjects: Array<{ name: string; score: number; grade: string }>;
}

export const children: Child[] = [
  {
    id: 'c1', name: 'Amani Mushi', klass: 'Std 5 A', admissionNo: 'GV/2026/0049', photoInitials: 'AM',
    feeDue: 460_000, feePaid: 260_000, controlNo: '000100000497', dueDate: '15 Jun 2026',
    attendanceRate: 94, last5: ['P', 'P', 'P', 'L', 'P'],
    average: 71.4, position: 4, classSize: 12,
    subjects: [
      { name: 'Kiswahili', score: 84, grade: 'A' }, { name: 'English', score: 67, grade: 'B' },
      { name: 'Mathematics', score: 73, grade: 'B' }, { name: 'Science & Technology', score: 78, grade: 'B' },
      { name: 'Social Studies', score: 62, grade: 'B' }, { name: 'Civics & Moral Ed.', score: 70, grade: 'B' },
      { name: 'Religion', score: 66, grade: 'B' }, { name: 'Vocational Skills', score: 71, grade: 'B' },
    ],
  },
  {
    id: 'c2', name: 'Neema Mushi', klass: 'Std 2 A', admissionNo: 'GV/2026/0014', photoInitials: 'NM',
    feeDue: 460_000, feePaid: 460_000, controlNo: '000100000141', dueDate: '15 Jun 2026',
    attendanceRate: 98, last5: ['P', 'P', 'P', 'P', 'P'],
    average: 83.6, position: 1, classSize: 12,
    subjects: [
      { name: 'Kiswahili', score: 91, grade: 'A' }, { name: 'English', score: 82, grade: 'A' },
      { name: 'Mathematics', score: 88, grade: 'A' }, { name: 'Science & Technology', score: 79, grade: 'B' },
      { name: 'Social Studies', score: 84, grade: 'A' }, { name: 'Civics & Moral Ed.', score: 80, grade: 'B' },
      { name: 'Religion', score: 78, grade: 'B' }, { name: 'Vocational Skills', score: 87, grade: 'A' },
    ],
  },
];

export const announcements = [
  { date: '10 Jun', title: 'Fee reminder — Term 2', body: 'Kindly clear Term 2 balances before 19 June. Lipa kwa namba ya malipo.', urgent: true },
  { date: '08 Jun', title: 'Mid-term exam timetable', body: 'Mid-term exams run 22–25 June. Timetable attached in the app.', urgent: false },
  { date: '02 Jun', title: 'School reopened', body: 'Karibuni tena! Classes resumed Monday 1 June at 07:30.', urgent: false },
];

export const fmtTZS = (n: number) => `TZS ${n.toLocaleString('en-US')}`;
