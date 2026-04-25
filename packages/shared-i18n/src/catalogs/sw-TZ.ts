/**
 * sw-TZ catalog — Kiswahili Sanifu (Tanzania standard Swahili).
 *
 * STATUS: DRAFT — must be reviewed and approved by a native Swahili
 * linguistic reviewer before any UI or SMS feature is marked GA.
 * Do NOT ship Swahili-facing features without reviewer sign-off.
 * See plan §5.7.6 for the Swahili quality gate process.
 *
 * Review checklist (per feature):
 *  - [ ] Grammar reviewed by native speaker
 *  - [ ] Education domain terminology verified (MoEST glossary)
 *  - [ ] SMS character limits checked (160 chars)
 *  - [ ] Formal register confirmed (not colloquial)
 */
export const swTZ = {
  locale: 'sw-TZ' as const,

  common: {
    save: 'Hifadhi',
    cancel: 'Ghairi',
    confirm: 'Thibitisha',
    delete: 'Futa',
    edit: 'Hariri',
    back: 'Rudi',
    loading: 'Inapakia…',
    error: 'Hitilafu imetokea. Tafadhali jaribu tena.',
    noData: 'Hakuna rekodi zilizopatikana.',
    search: 'Tafuta',
    filter: 'Chuja',
    export: 'Hamisha',
    print: 'Chapisha',
    close: 'Funga',
    yes: 'Ndiyo',
    no: 'Hapana',
    required: 'Sehemu hii inahitajika.',
    aiBadge: 'Imeandikwa na AI — tafadhali kagua kabla ya kuhifadhi',
  },

  nav: {
    dashboard: 'Dashibodi',
    students: 'Wanafunzi',
    admissions: 'Maombi ya Kujiunga',
    academic: 'Masomo',
    attendance: 'Mahudhurio',
    exams: 'Mitihani na Madaraja',
    fees: 'Ada',
    payments: 'Malipo',
    accounting: 'Uhasibu',
    payroll: 'Mishahara',
    boarding: 'Bweni',
    transport: 'Usafiri',
    meals: 'Mkahawa',
    reports: 'Ripoti',
    settings: 'Mipangilio',
    logout: 'Toka',
  },

  students: {
    title: 'Wanafunzi',
    addStudent: 'Andikisha Mwanafunzi',
    admissionNo: 'Nambari ya Usajili',
    fullName: 'Jina Kamili',
    dob: 'Tarehe ya Kuzaliwa',
    gender: 'Jinsia',
    class: 'Darasa',
    guardian: 'Mlezi',
    guardianPhone: 'Simu ya Mlezi',
    status: 'Hali',
    active: 'Hai',
    withdrawn: 'Amejiondoa',
    transferred: 'Amehamia',
  },

  fees: {
    title: 'Ada',
    invoice: 'Ankara',
    invoiceNo: 'Nambari ya Ankara',
    controlNo: 'Nambari ya Udhibiti',
    totalDue: 'Jumla Inayodaiwa',
    totalPaid: 'Jumla Iliyolipwa',
    balance: 'Baki',
    status: {
      draft: 'Rasimu',
      issued: 'Imetolewa',
      partial: 'Sehemu',
      paid: 'Imelipwa',
      overdue: 'Imechelewa',
      void: 'Batili',
    },
    payNow: 'Lipa Sasa',
    payViaMpesa: 'Lipa kwa M-Pesa',
    payViaBank: 'Lipa kwa Benki',
    payByCash: 'Rekodi Malipo ya Taslimu',
    receiptIssued: 'Risiti imetolewa',
  },

  attendance: {
    title: 'Mahudhurio',
    present: 'Amehuduria',
    absent: 'Hayupo',
    late: 'Amechelewa',
    excused: 'Ameruhusiwa',
    markAttendance: 'Rekodi Mahudhurio',
    session: 'Kipindi',
    attendanceRate: 'Kiwango cha Mahudhurio',
  },

  exams: {
    title: 'Mitihani na Madaraja',
    reportCard: 'Ripoti ya Maendeleo',
    position: 'Nafasi',
    grade: 'Daraja',
    score: 'Alama',
    subject: 'Somo',
    teacherComment: 'Maoni ya Mwalimu',
    aiDraftedComment: 'Maoni Yaliyoandikwa na AI (kagua kabla ya kuhifadhi)',
    termAverage: 'Wastani wa Muhula',
  },

  payroll: {
    title: 'Mishahara',
    period: 'Kipindi cha Malipo',
    gross: 'Jumla ya Mshahara',
    netPay: 'Mshahara Halisi',
    paye: 'PAYE',
    nssf: 'NSSF',
    wcf: 'WCF',
    sdl: 'SDL',
    heslb: 'HESLB',
    deductions: 'Makato',
    disbursementMethod: 'Njia ya Malipo',
    runPayroll: 'Fanya Mishahara',
    approvePayroll: 'Idhibiti na Chapisha',
    payslip: 'Kijitabu cha Mshahara',
  },

  boarding: {
    title: 'Bweni',
    dorm: 'Chumba cha Kulala',
    bed: 'Kitanda',
    occupied: 'Kimechukuliwa',
    vacant: 'Kipo Wazi',
    leaveOut: 'Ruhusa ya Kutoka',
    request: 'Omba Ruhusa',
    approve: 'Idhibiti',
    reject: 'Kataa',
    returned: 'Amekuja Nyumbani',
    visitor: 'Mgeni',
    sickBay: 'Chumba cha Afya',
    admit: 'Pokea Mgonjwa',
    discharge: 'Mruhusu Aende',
  },

  parent: {
    myChildren: 'Watoto Wangu',
    fees: 'Ada na Malipo',
    grades: 'Madaraja',
    attendance: 'Mahudhurio',
    messages: 'Ujumbe',
    payFees: 'Lipa Ada',
    viewReport: 'Tazama Ripoti ya Maendeleo',
    canteenBalance: 'Baki ya Mkahawa',
  },

  reports: {
    trialBalance: 'Usawa wa Majaribio',
    incomeStatement: 'Taarifa ya Mapato',
    balanceSheet: 'Karatasi ya Usawa',
    budgetVariance: 'Bajeti dhidi ya Halisi',
    necta: 'Orodha ya Watahiniwa wa NECTA',
    bemis: 'Takwimu za BEMIS',
    inspectorExport: 'Ripoti ya Mkaguzi',
    atRisk: 'Wanafunzi Walio Hatarini',
    payeReturn: 'Ripoti ya Kodi ya PAYE',
    nssfFile: 'Faili la Michango ya NSSF',
  },

  sms: {
    feeReminder: (name: string, amount: string, dueDate: string, controlNo: string) =>
      `Mzazi/Mlezi wa ${name}, ada ya TZS ${amount} inadaiwa ifikapo ${dueDate}. Nambari ya Udhibiti: ${controlNo}. Lipa kwa M-Pesa au benki. Asante.`,
    paymentReceived: (name: string, amount: string, receiptNo: string) =>
      `Malipo ya TZS ${amount} yamepokelewa kwa ${name}. Risiti: ${receiptNo}. Asante.`,
    reportCardReady: (name: string) =>
      `Ripoti ya maendeleo ya ${name} ipo tayari. Ingia kwenye mfumo wa wazazi kuona. Mfumo wa Lumora.`,
    leaveOutApproved: (name: string, leaveDate: string, returnDate: string) =>
      `Ruhusa ya kutoka imeidhibitiwa kwa ${name} kuanzia ${leaveDate} hadi ${returnDate}. Tafadhali arudi kwa wakati.`,
  },
} as const;
