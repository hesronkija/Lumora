import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { DB_POOL } from '../../database/database.module';
import { TenantStorage } from '@lumora/shared-tenancy';
import {
  buildReportCardCommentPrompt,
  parseCommentResponse,
  buildAnnouncementPrompt,
  type StudentPerformance,
  type AnnouncementDraftRequest,
  type AiGatewayResponse,
  type AiGatewayRequest,
} from '@lumora/domain-ai';
import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';

export type Locale = 'en-TZ' | 'sw-TZ';

/**
 * AI & Intelligence module.
 *
 * Architecture: every feature works in BOTH modes —
 *  - GATEWAY mode: AI_GATEWAY_URL points at the in-region vLLM gateway
 *    (PII is scrubbed before the prompt leaves the process).
 *  - LOCAL mode (default in dev / cost-saving): a deterministic engine
 *    produces useful output from the same inputs. Schools without a GPU
 *    budget still get working report comments and the parent assistant.
 *
 * Every generation is logged to ai_request for the per-tenant cost ledger,
 * and every draft requires explicit human approval before reaching a
 * parent or a report card (status: drafted → human_accepted).
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  private get gatewayUrl(): string | undefined {
    return process.env['AI_GATEWAY_URL'] || undefined;
  }

  // ── Gateway plumbing ───────────────────────────────────────────────────────

  private async callGateway(
    req: Omit<AiGatewayRequest, 'tenantId' | 'userId'>,
  ): Promise<AiGatewayResponse | null> {
    if (!this.gatewayUrl) return null;
    const { tenantId, userId } = TenantStorage.get();
    try {
      const resp = await fetch(`${this.gatewayUrl}/v1/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...req, tenantId, userId }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!resp.ok) {
        this.logger.warn(`AI gateway returned ${resp.status} — falling back to local engine`);
        return null;
      }
      return (await resp.json()) as AiGatewayResponse;
    } catch (err) {
      this.logger.warn(`AI gateway unreachable (${err instanceof Error ? err.message : 'error'}) — local engine`);
      return null;
    }
  }

  private async logRequest(featureCode: string, mode: 'gateway' | 'local', tokens = 0): Promise<string> {
    const { tenantId, userId } = TenantStorage.get();
    const id = uuidv4();
    await this.pool
      .query(
        `INSERT INTO ai_request (id, tenant_id, user_id, feature_code, status, model, tokens_in, tokens_out)
         VALUES ($1,$2,$3,$4,'drafted',$5,$6,0)`,
        [id, tenantId, userId, featureCode, mode === 'gateway' ? 'vllm' : 'local-deterministic', tokens],
      )
      .catch(() => undefined); // logging must never break the feature
    return id;
  }

  // ── A1: Report-card comment drafts ─────────────────────────────────────────

  async draftReportComment(perf: StudentPerformance, locale: Locale = 'en-TZ') {
    const { request, piiMap } = buildReportCardCommentPrompt(perf, locale);
    const gw = await this.callGateway(request);
    if (gw) {
      await this.logRequest('A1_report_card_comments', 'gateway', gw.tokensIn + gw.tokensOut);
      return { ...parseCommentResponse(gw, piiMap, locale), mode: 'gateway' as const };
    }
    const requestId = await this.logRequest('A1_report_card_comments', 'local');
    return { draft: localComment(perf, locale), locale, mode: 'local' as const, requestId };
  }

  // ── A8: Announcement drafts ────────────────────────────────────────────────

  async draftAnnouncement(input: AnnouncementDraftRequest & { locale: Locale }) {
    const gw = await this.callGateway(buildAnnouncementPrompt(input));
    if (gw) {
      await this.logRequest('A8_announcement_draft', 'gateway', gw.tokensIn + gw.tokensOut);
      const draft = gw.output.trim();
      return { draft, charCount: draft.length, withinLimit: draft.length <= (input.maxLength ?? 160), mode: 'gateway' as const };
    }
    await this.logRequest('A8_announcement_draft', 'local');
    const draft = localAnnouncement(input);
    const limit = input.maxLength ?? (input.channel === 'sms' ? 160 : 1600);
    return { draft, charCount: draft.length, withinLimit: draft.length <= limit, mode: 'local' as const };
  }

  // ── A4: Parent assistant (guardrailed, grounded in tenant data) ────────────

  /**
   * Answers a parent's question from THEIR OWN children's records only.
   * Intent routing is deterministic; the optional LLM merely rephrases.
   * RLS plus the parent-scope predicate make cross-family leaks structurally
   * impossible: every query is keyed on the guardian link.
   */
  async parentChat(question: string, parentUserId: string, locale: Locale = 'en-TZ') {
    const intent = classifyIntent(question);
    await this.logRequest('A4_parent_chatbot', 'local');

    const { rows: children } = await this.pool.query(
      `SELECT s.id, s.legal_name
       FROM student s
       JOIN student_guardian sg ON sg.student_id = s.id
       JOIN guardian g ON g.id = sg.guardian_id
       WHERE g.user_id = $1 AND s.active = true`,
      [parentUserId],
    );
    if (children.length === 0) {
      return { intent, answer: t(locale, 'no_children'), escalate: true };
    }

    switch (intent) {
      case 'fees': {
        const parts: string[] = [];
        for (const child of children) {
          const { rows } = await this.pool.query(
            `SELECT COALESCE(SUM(total_due - total_paid), 0) AS balance
             FROM invoice WHERE student_id = $1 AND status NOT IN ('void','paid')`,
            [child.id],
          );
          const balance = new Decimal((rows[0]?.balance as string) ?? '0');
          parts.push(
            t(locale, 'fees_balance', {
              name: child.legal_name as string,
              amount: balance.toNumber().toLocaleString('en-TZ'),
            }),
          );
        }
        return { intent, answer: parts.join(' '), escalate: false };
      }
      case 'attendance': {
        const parts: string[] = [];
        for (const child of children) {
          const { rows } = await this.pool.query(
            `SELECT
               COUNT(*) FILTER (WHERE ar.status = 'present')::float AS present,
               COUNT(*)::float AS total
             FROM attendance_record ar
             JOIN attendance_session ases ON ases.id = ar.session_id
             WHERE ar.student_id = $1 AND ases.date > NOW() - INTERVAL '28 days'`,
            [child.id],
          );
          const total = Number(rows[0]?.total ?? 0);
          const pct = total > 0 ? Math.round((Number(rows[0]?.present ?? 0) / total) * 100) : null;
          parts.push(
            pct === null
              ? t(locale, 'attendance_none', { name: child.legal_name as string })
              : t(locale, 'attendance', { name: child.legal_name as string, pct: String(pct) }),
          );
        }
        return { intent, answer: parts.join(' '), escalate: false };
      }
      case 'grades': {
        const parts: string[] = [];
        for (const child of children) {
          const { rows } = await this.pool.query(
            `SELECT rc.average_marks, rc.position_in_class, rc.total_students_in_class
             FROM report_card rc WHERE rc.student_id = $1 AND rc.status = 'published'
             ORDER BY rc.created_at DESC LIMIT 1`,
            [child.id],
          );
          parts.push(
            rows[0]
              ? t(locale, 'grades', {
                  name: child.legal_name as string,
                  avg: String(rows[0].average_marks),
                  pos: String(rows[0].position_in_class),
                  of: String(rows[0].total_students_in_class),
                })
              : t(locale, 'grades_none', { name: child.legal_name as string }),
          );
        }
        return { intent, answer: parts.join(' '), escalate: false };
      }
      default:
        return { intent: 'other', answer: t(locale, 'escalate'), escalate: true };
    }
  }
}

// ── Deterministic engines (no LLM required) ──────────────────────────────────

function localComment(perf: StudentPerformance, locale: Locale): string {
  const pct = perf.percentage;
  const trend =
    perf.previousTermPercentage === undefined
      ? 'flat'
      : pct - perf.previousTermPercentage > 5
        ? 'up'
        : perf.previousTermPercentage - pct > 5
          ? 'down'
          : 'flat';
  const band = pct >= 80 ? 'excellent' : pct >= 65 ? 'good' : pct >= 50 ? 'average' : pct >= 35 ? 'below' : 'poor';

  const en: Record<string, string> = {
    excellent: `Outstanding work in ${perf.subjectName} this term, finishing ${ordinal(perf.positionInClass)} of ${perf.classSize}. Keep up the same discipline and curiosity.`,
    good: `A solid performance in ${perf.subjectName} with grade ${perf.grade}. With steady revision, the top band is within reach.`,
    average: `A fair result in ${perf.subjectName}. More consistent practice — especially past exercises — will lift the next result.`,
    below: `${perf.subjectName} needs closer attention this coming term. Extra practice at home and asking questions in class will help.`,
    poor: `A difficult term in ${perf.subjectName}. A guided study plan and regular follow-up between home and school is recommended.`,
  };
  const sw: Record<string, string> = {
    excellent: `Amefanya vizuri sana katika ${perf.subjectName} muhula huu, akishika nafasi ya ${perf.positionInClass} kati ya ${perf.classSize}. Aendelee na bidii ileile.`,
    good: `Matokeo mazuri katika ${perf.subjectName} akipata daraja ${perf.grade}. Kwa marudio ya mara kwa mara, anaweza kufikia daraja la juu zaidi.`,
    average: `Matokeo ya wastani katika ${perf.subjectName}. Mazoezi zaidi ya mara kwa mara yatainua matokeo yajayo.`,
    below: `Anahitaji msaada zaidi katika ${perf.subjectName} muhula ujao. Mazoezi ya nyumbani na kuuliza maswali darasani vitasaidia.`,
    poor: `Muhula mgumu katika ${perf.subjectName}. Tunapendekeza mpango wa masomo ya ziada na ufuatiliaji wa karibu kati ya nyumbani na shule.`,
  };
  const trendEn = { up: ' A clear improvement on last term — well done.', down: ' Note the drop from last term.', flat: '' }[trend];
  const trendSw = { up: ' Ameboresha ikilinganishwa na muhula uliopita — hongera.', down: ' Amepungua ikilinganishwa na muhula uliopita.', flat: '' }[trend];
  return locale === 'sw-TZ' ? sw[band]! + trendSw : en[band]! + trendEn;
}

function localAnnouncement(input: AnnouncementDraftRequest & { locale: Locale }): string {
  const prefix = input.locale === 'sw-TZ' ? `${input.tenantName}: ` : `${input.tenantName}: `;
  // The intent is already plain language from the headteacher; the local
  // engine normalises it into a courteous parent-facing message.
  const body = input.intent.trim().replace(/\s+/g, ' ');
  const courteous =
    input.locale === 'sw-TZ'
      ? `Ndugu Mzazi/Mlezi, ${body}. Asante. — ${input.tenantName}`
      : `Dear Parent/Guardian, ${body}. Thank you. — ${input.tenantName}`;
  const limit = input.maxLength ?? (input.channel === 'sms' ? 160 : 1600);
  return courteous.length <= limit ? courteous : `${prefix}${body}`.slice(0, limit);
}

type Intent = 'fees' | 'attendance' | 'grades' | 'other';

function classifyIntent(q: string): Intent {
  const s = q.toLowerCase();
  if (/(fee|ada|balance|deni|lipa|pay|invoice|karo)/.test(s)) return 'fees';
  if (/(attendance|mahudhurio|absent|hudhuri|kuhudhuria)/.test(s)) return 'attendance';
  if (/(grade|matokeo|result|exam|mtihani|report|ripoti|performance)/.test(s)) return 'grades';
  return 'other';
}

function t(locale: Locale, key: string, vars: Record<string, string> = {}): string {
  const en: Record<string, string> = {
    no_children: 'I could not find any active students linked to your account. Please contact the school office.',
    fees_balance: '{name} has an outstanding fee balance of TZS {amount}.',
    attendance: '{name} attended {pct}% of school days in the last 4 weeks.',
    attendance_none: 'No attendance records yet for {name} in the last 4 weeks.',
    grades: '{name} averaged {avg}% last term, position {pos} of {of}.',
    grades_none: 'No published report card yet for {name}.',
    escalate: 'I will forward your question to the school office — they will reply shortly.',
  };
  const sw: Record<string, string> = {
    no_children: 'Sikupata mwanafunzi aliyeunganishwa na akaunti yako. Tafadhali wasiliana na ofisi ya shule.',
    fees_balance: '{name} ana deni la ada la TZS {amount}.',
    attendance: '{name} amehudhuria {pct}% ya siku za shule katika wiki 4 zilizopita.',
    attendance_none: 'Hakuna kumbukumbu za mahudhurio za {name} katika wiki 4 zilizopita.',
    grades: '{name} alipata wastani wa {avg}% muhula uliopita, nafasi ya {pos} kati ya {of}.',
    grades_none: 'Ripoti ya {name} bado haijachapishwa.',
    escalate: 'Nitapeleka swali lako kwa ofisi ya shule — watakujibu hivi karibuni.',
  };
  const dict = locale === 'sw-TZ' ? sw : en;
  return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), dict[key] ?? key);
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}
