'use client';

/**
 * Lightweight bilingual i18n (English / Kiswahili) with a topbar toggle.
 * Swahili is a first-class language here — not an afterthought.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'sw';

const dict = {
  // navigation
  dashboard: ['Dashboard', 'Dashibodi'],
  users: ['Users & Roles', 'Watumiaji na Majukumu'],
  admissions: ['Admissions', 'Udahili'],
  students: ['Students', 'Wanafunzi'],
  academic: ['Academic', 'Taaluma'],
  attendance: ['Attendance', 'Mahudhurio'],
  fees: ['Fees & Billing', 'Ada na Ankara'],
  payments: ['Payments', 'Malipo'],
  accounting: ['Accounting', 'Uhasibu'],
  payroll: ['Payroll', 'Mishahara'],
  hr: ['Staff / HR', 'Watumishi'],
  boarding: ['Boarding', 'Bweni'],
  transport: ['Transport & Meals', 'Usafiri na Chakula'],
  reports: ['Reports', 'Ripoti'],
  ai: ['AI Assistant', 'Msaidizi AI'],
  settings: ['Settings', 'Mipangilio'],
  exams: ['Exams & Grading', 'Mitihani na Matokeo'],
  comms: ['Communications', 'Mawasiliano'],
  pulse: ['Shule Pulse', 'Shule Pulse'],
  timetable: ['Timetable', 'Ratiba'],
  idcards: ['ID Cards', 'Vitambulisho'],
  harambee: ['Harambee', 'Harambee'],

  // common
  search: ['Search…', 'Tafuta…'],
  name: ['Name', 'Jina'],
  klass: ['Class', 'Darasa'],
  status: ['Status', 'Hali'],
  actions: ['Actions', 'Vitendo'],
  total: ['Total', 'Jumla'],
  date: ['Date', 'Tarehe'],
  amount: ['Amount', 'Kiasi'],
  balance: ['Balance', 'Salio'],
  paid: ['Paid', 'Imelipwa'],
  partial: ['Partial', 'Sehemu'],
  issued: ['Unpaid', 'Haijalipwa'],
  all: ['All', 'Zote'],
  export: ['Export', 'Hamisha'],
  signout: ['Sign out', 'Toka'],
  welcome: ['Welcome back', 'Karibu tena'],
  viewAll: ['View all', 'Ona zote'],
  guardian: ['Guardian', 'Mzazi/Mlezi'],
  phone: ['Phone', 'Simu'],
  position: ['Position', 'Nafasi'],
  average: ['Average', 'Wastani'],
  active: ['Active', 'Hai'],
  demoMode: ['Demo data', 'Data ya mfano'],

  // dashboard
  totalStudents: ['Total Students', 'Jumla ya Wanafunzi'],
  activeStaff: ['Active Staff', 'Watumishi Hai'],
  feesCollected: ['Fees Collected (Term 2)', 'Ada Zilizokusanywa (Muhula 2)'],
  outstandingArrears: ['Outstanding Arrears', 'Madeni ya Ada'],
  attendanceToday: ['Attendance (4 weeks)', 'Mahudhurio (wiki 4)'],
  collectionRate: ['Collection Rate', 'Kiwango cha Ukusanyaji'],
  weeklyCollections: ['Weekly fee collections', 'Makusanyo ya ada kwa wiki'],
  attendanceByClass: ['Attendance by class', 'Mahudhurio kwa darasa'],
  paymentChannels: ['Payment channels', 'Njia za malipo'],
  recentPayments: ['Recent payments', 'Malipo ya hivi karibuni'],
  atRiskStudents: ['Students needing attention', 'Wanafunzi wanaohitaji ufuatiliaji'],
  riskSignals: ['Signals', 'Viashiria'],

  // fees/payments
  invoiceNo: ['Invoice No', 'Namba ya Ankara'],
  controlNo: ['Control No', 'Namba ya Malipo'],
  dueDate: ['Due date', 'Tarehe ya mwisho'],
  channel: ['Channel', 'Njia'],
  provider: ['Provider', 'Mtoa huduma'],
  reference: ['Reference', 'Kumbukumbu'],
  reconciliation: ['Reconciliation', 'Usuluhishi'],

  // payroll
  grossPay: ['Gross', 'Mshahara ghafi'],
  netPay: ['Net pay', 'Mshahara halisi'],
  deductions: ['Deductions', 'Makato'],
  employerCosts: ['Employer costs', 'Gharama za mwajiri'],
  runPayroll: ['May 2026 payroll run', 'Mshahara wa Mei 2026'],

  // ai
  askPlaceholder: ['Ask about fees, attendance or results…', 'Uliza kuhusu ada, mahudhurio au matokeo…'],
  draftComment: ['Draft report comment', 'Andaa maoni ya ripoti'],
  draftAnnouncement: ['Draft announcement', 'Andaa tangazo'],
  parentAssistant: ['Parent assistant', 'Msaidizi wa wazazi'],
} as const;

export type TKey = keyof typeof dict;

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string }>({
  lang: 'en', setLang: () => undefined, t: (k) => dict[k]?.[0] ?? k,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  useEffect(() => {
    const saved = window.localStorage.getItem('lumora.lang') as Lang | null;
    if (saved === 'sw' || saved === 'en') setLangState(saved);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    window.localStorage.setItem('lumora.lang', l);
  };
  const t = (k: TKey) => dict[k]?.[lang === 'sw' ? 1 : 0] ?? k;
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export const useI18n = () => useContext(LangContext);
