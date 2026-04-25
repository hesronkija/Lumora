/**
 * en-TZ catalog — Tanzanian English.
 * Uses British spelling conventions. Currency always in TZS.
 * Reviewed by domain expert before GA.
 */
export const enTZ = {
  locale: 'en-TZ' as const,

  common: {
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    edit: 'Edit',
    back: 'Back',
    loading: 'Loading…',
    error: 'Something went wrong. Please try again.',
    noData: 'No records found.',
    search: 'Search',
    filter: 'Filter',
    export: 'Export',
    print: 'Print',
    close: 'Close',
    yes: 'Yes',
    no: 'No',
    required: 'This field is required.',
    aiBadge: 'AI-drafted — please review before saving',
  },

  nav: {
    dashboard: 'Dashboard',
    students: 'Students',
    admissions: 'Admissions',
    academic: 'Academic',
    attendance: 'Attendance',
    exams: 'Exams & Grades',
    fees: 'Fees',
    payments: 'Payments',
    accounting: 'Accounting',
    payroll: 'Payroll',
    boarding: 'Boarding',
    transport: 'Transport',
    meals: 'Canteen',
    reports: 'Reports',
    settings: 'Settings',
    logout: 'Log Out',
  },

  students: {
    title: 'Students',
    addStudent: 'Enrol Student',
    admissionNo: 'Admission No.',
    fullName: 'Full Name',
    dob: 'Date of Birth',
    gender: 'Gender',
    class: 'Class',
    guardian: 'Guardian',
    guardianPhone: 'Guardian Phone',
    status: 'Status',
    active: 'Active',
    withdrawn: 'Withdrawn',
    transferred: 'Transferred',
  },

  fees: {
    title: 'Fees',
    invoice: 'Invoice',
    invoiceNo: 'Invoice No.',
    controlNo: 'Control No.',
    totalDue: 'Total Due',
    totalPaid: 'Total Paid',
    balance: 'Balance',
    status: {
      draft: 'Draft',
      issued: 'Issued',
      partial: 'Partial',
      paid: 'Paid',
      overdue: 'Overdue',
      void: 'Void',
    },
    payNow: 'Pay Now',
    payViaMpesa: 'Pay via M-Pesa',
    payViaBank: 'Pay via Bank',
    payByCash: 'Record Cash Payment',
    receiptIssued: 'Receipt issued',
  },

  attendance: {
    title: 'Attendance',
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    excused: 'Excused',
    markAttendance: 'Mark Attendance',
    session: 'Session',
    attendanceRate: 'Attendance Rate',
  },

  exams: {
    title: 'Exams & Grades',
    reportCard: 'Report Card',
    position: 'Position',
    grade: 'Grade',
    score: 'Score',
    subject: 'Subject',
    teacherComment: 'Teacher\'s Comment',
    aiDraftedComment: 'AI-Drafted Comment (review before saving)',
    termAverage: 'Term Average',
  },

  payroll: {
    title: 'Payroll',
    period: 'Pay Period',
    gross: 'Gross Pay',
    netPay: 'Net Pay',
    paye: 'PAYE',
    nssf: 'NSSF',
    wcf: 'WCF',
    sdl: 'SDL',
    heslb: 'HESLB',
    deductions: 'Deductions',
    disbursementMethod: 'Disbursement Method',
    runPayroll: 'Run Payroll',
    approvePayroll: 'Approve & Post',
    payslip: 'Payslip',
  },

  boarding: {
    title: 'Boarding',
    dorm: 'Dormitory',
    bed: 'Bed',
    occupied: 'Occupied',
    vacant: 'Vacant',
    leaveOut: 'Leave-Out',
    request: 'Request Leave-Out',
    approve: 'Approve',
    reject: 'Reject',
    returned: 'Mark as Returned',
    visitor: 'Visitor',
    sickBay: 'Sick Bay',
    admit: 'Admit to Sick Bay',
    discharge: 'Discharge',
  },

  parent: {
    myChildren: 'My Children',
    fees: 'Fees & Payments',
    grades: 'Grades',
    attendance: 'Attendance',
    messages: 'Messages',
    payFees: 'Pay Fees',
    viewReport: 'View Report Card',
    canteenBalance: 'Canteen Balance',
  },

  reports: {
    trialBalance: 'Trial Balance',
    incomeStatement: 'Income Statement',
    balanceSheet: 'Balance Sheet',
    budgetVariance: 'Budget vs Actual',
    necta: 'NECTA Candidate Export',
    bemis: 'BEMIS Data Feed',
    inspectorExport: 'Inspector Export',
    atRisk: 'At-Risk Students',
    payeReturn: 'PAYE Monthly Return',
    nssfFile: 'NSSF Contribution File',
  },

  sms: {
    feeReminder: (name: string, amount: string, dueDate: string, controlNo: string) =>
      `Dear Guardian of ${name}, school fees of TZS ${amount} are due by ${dueDate}. Control No: ${controlNo}. Pay via M-Pesa or bank. Thank you.`,
    paymentReceived: (name: string, amount: string, receiptNo: string) =>
      `Payment of TZS ${amount} received for ${name}. Receipt: ${receiptNo}. Thank you.`,
    reportCardReady: (name: string) =>
      `The report card for ${name} is ready. Log in to the parent portal to view. Lumora School System.`,
    leaveOutApproved: (name: string, leaveDate: string, returnDate: string) =>
      `Leave-out approved for ${name} from ${leaveDate} to ${returnDate}. Please ensure timely return.`,
  },
} as const;

export type I18nKey = typeof enTZ;
