import { AiService } from './ai.service';
import { TenantStorage } from '@lumora/shared-tenancy';

const TENANT = '11111111-1111-1111-1111-111111111111';
const inTenant = <T>(fn: () => Promise<T>) =>
  TenantStorage.run({ tenantId: TENANT, userId: 'parent-1', roles: ['parent'], scopes: {} }, fn);

describe('AI service — local deterministic engines', () => {
  let db: Record<string, unknown[]>;
  const pool = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM student s')) return { rows: db['children'] ?? [], rowCount: 0 };
      if (sql.includes('FROM invoice')) return { rows: [{ balance: '450000' }], rowCount: 1 };
      if (sql.includes('FROM attendance_record')) return { rows: [{ present: 18, total: 20 }], rowCount: 1 };
      if (sql.includes('FROM report_card')) return { rows: [{ average_marks: '71.50', position_in_class: 5, total_students_in_class: 42 }], rowCount: 1 };
      if (sql.includes('INSERT INTO ai_request')) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }),
  } as never;
  const svc = new AiService(pool);

  beforeEach(() => {
    db = { children: [{ id: 'child-1', legal_name: 'Amani Juma' }] };
  });

  const perf = {
    studentName: 'Amani Juma', admissionNo: 'STD-001', subjectName: 'Hisabati',
    score: 86, maxScore: 100, percentage: 86, positionInClass: 2, classSize: 40,
    grade: 'A', previousTermPercentage: 74,
  };

  it('drafts an encouraging English report comment without any LLM', async () => {
    const r = await inTenant(() => svc.draftReportComment(perf, 'en-TZ'));
    expect(r.mode).toBe('local');
    expect(r.draft).toContain('Hisabati');
    expect(r.draft).toContain('2nd of 40');
    expect(r.draft).toMatch(/improvement/i);
  });

  it('drafts the same comment in Swahili', async () => {
    const r = await inTenant(() => svc.draftReportComment(perf, 'sw-TZ'));
    expect(r.draft).toContain('Hisabati');
    expect(r.draft).toMatch(/vizuri sana|hongera/i);
  });

  it('struggling student gets a constructive (not punitive) comment', async () => {
    const r = await inTenant(() =>
      svc.draftReportComment({ ...perf, percentage: 28, score: 28, grade: 'E' }, 'en-TZ'),
    );
    expect(r.draft).toMatch(/study plan|recommended/i);
    expect(r.draft).not.toMatch(/fail|stupid|lazy/i);
  });

  it('parent chat: answers a fee-balance question in Swahili from real data', async () => {
    const r = await inTenant(() => svc.parentChat('Nina deni gani la ada?', 'parent-1', 'sw-TZ'));
    expect(r.intent).toBe('fees');
    expect(r.answer).toContain('Amani Juma');
    expect(r.answer).toContain('450,000');
    expect(r.escalate).toBe(false);
  });

  it('parent chat: attendance question in English', async () => {
    const r = await inTenant(() => svc.parentChat('How is attendance this month?', 'parent-1', 'en-TZ'));
    expect(r.intent).toBe('attendance');
    expect(r.answer).toContain('90%');
  });

  it('parent chat: results question', async () => {
    const r = await inTenant(() => svc.parentChat('matokeo ya mtihani?', 'parent-1', 'sw-TZ'));
    expect(r.intent).toBe('grades');
    expect(r.answer).toContain('71.50');
  });

  it('escalates off-topic questions to a human', async () => {
    const r = await inTenant(() => svc.parentChat('Can you fix my car?', 'parent-1', 'en-TZ'));
    expect(r.escalate).toBe(true);
  });

  it('refuses politely when the user has no linked children', async () => {
    db['children'] = [];
    const r = await inTenant(() => svc.parentChat('fees?', 'parent-1', 'en-TZ'));
    expect(r.escalate).toBe(true);
    expect(r.answer).toMatch(/school office|ofisi/i);
  });

  it('announcement draft respects the SMS length limit', async () => {
    const r = await inTenant(() =>
      svc.draftAnnouncement({
        tenantName: 'Shule ya Mfano', intent: 'remind parents fees are due Friday',
        channel: 'sms', locale: 'en-TZ',
      }),
    );
    expect(r.draft).toContain('Dear Parent');
    expect(r.withinLimit).toBe(true);
  });
});
