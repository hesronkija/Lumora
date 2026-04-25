/**
 * A1: Report-Card Comment Drafts
 * Phase 2 private beta → Phase 3 GA.
 * Swahili comments gated on native-reviewer sign-off (Phase 5).
 *
 * Generates a per-student, per-subject comment draft for teachers to edit and approve.
 * Human (teacher/headteacher) must approve before the comment appears on any report card.
 *
 * PII handling: student name and admission number are scrubbed before prompting.
 * Grades are included (not PII by themselves, but anonymised with the student reference).
 */

import { scrubPii, rehydratePii } from '../pii/scrubber';
import type { AiGatewayRequest, AiGatewayResponse } from '../gateway/types';

export interface StudentPerformance {
  studentName: string;
  admissionNo: string;
  subjectName: string;
  score: number; // raw mark
  maxScore: number;
  percentage: number;
  positionInClass: number;
  classSize: number;
  grade: string; // e.g. 'A', 'B+', 'C'
  previousTermPercentage?: number; // trend context
}

export interface CommentDraftResult {
  draft: string;
  locale: 'en-TZ' | 'sw-TZ';
}

export function buildReportCardCommentPrompt(
  perf: StudentPerformance,
  locale: 'en-TZ' | 'sw-TZ' = 'en-TZ',
): { request: Omit<AiGatewayRequest, 'tenantId' | 'userId'>; piiMap: Map<string, string> } {
  const raw = [
    `Student: ${perf.studentName} (${perf.admissionNo})`,
    `Subject: ${perf.subjectName}`,
    `Score: ${perf.score}/${perf.maxScore} (${perf.percentage.toFixed(1)}%, Grade ${perf.grade})`,
    `Position: ${perf.positionInClass} of ${perf.classSize}`,
    perf.previousTermPercentage !== undefined
      ? `Previous term: ${perf.previousTermPercentage.toFixed(1)}%`
      : '',
  ].filter(Boolean).join('\n');

  const { scrubbed, piiMap } = scrubPii(raw);

  const languageInstruction = locale === 'sw-TZ'
    ? 'Write in formal Tanzanian Swahili (Kiswahili sanifu). Maximum 40 words.'
    : 'Write in formal English (Tanzanian school register). Maximum 40 words.';

  const prompt = `You are writing a brief teacher comment for a primary school report card.

${languageInstruction}

Performance data:
${scrubbed}

Write a constructive, encouraging comment that:
- Acknowledges the student's performance honestly
- Notes one specific strength or area for improvement
- Is appropriate for a parent to read
- Does NOT mention the student's name (the report card header already has it)

Write ONLY the comment text. No quotes, no label, no preamble.`;

  return {
    request: {
      featureCode: 'A1_report_card_comments',
      prompt,
      modelTier: 'large',
    },
    piiMap,
  };
}

export function parseCommentResponse(
  response: AiGatewayResponse,
  piiMap: Map<string, string>,
  locale: 'en-TZ' | 'sw-TZ',
): CommentDraftResult {
  const draft = rehydratePii(response.output.trim(), piiMap);
  return { draft, locale };
}
