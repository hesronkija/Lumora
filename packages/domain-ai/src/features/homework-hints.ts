/**
 * A11: Syllabus-Aware Homework Hint Explainer
 * Phase 5, gated pilot — parent app only.
 *
 * Strictly grounded RAG on approved Tanzanian primary school syllabus content.
 * Refuses any off-topic or out-of-curriculum queries.
 * Bilingual (en-TZ + sw-TZ) — Swahili gated on native-reviewer sign-off.
 *
 * NOT a tutoring service. Provides hints and explanations, not answers.
 * Does NOT replace teacher instruction.
 */

import type { AiGatewayRequest } from '../gateway/types';

export interface HomeworkHintRequest {
  question: string;           // student's homework question
  subject: string;            // e.g. 'Mathematics', 'Kiswahili', 'Science'
  classLevel: string;         // 'std1' – 'std7'
  locale: 'en-TZ' | 'sw-TZ';
  syllabusSnippets: string[]; // RAG context from approved syllabus content
}

export function buildHomeworkHintPrompt(
  req: HomeworkHintRequest,
): Omit<AiGatewayRequest, 'tenantId' | 'userId'> {
  const langInstruction = req.locale === 'sw-TZ'
    ? 'Respond in simple, clear Kiswahili appropriate for a primary school pupil.'
    : 'Respond in simple, clear English appropriate for a primary school pupil.';

  const prompt = `You are a homework helper for ${req.classLevel} ${req.subject}.
${langInstruction}

APPROVED SYLLABUS CONTENT (use ONLY this as your knowledge source):
${req.syllabusSnippets.join('\n---\n')}

STUDENT QUESTION:
${req.question}

RULES:
- Give a HINT or EXPLANATION only — do not give the final answer directly.
- If the question is not covered by the syllabus content above, say so and suggest the student asks their teacher.
- Do not discuss topics outside ${req.subject} for ${req.classLevel}.
- Keep response under 150 words.
- Never discuss violence, politics, religion, or adult content.`;

  return {
    featureCode: 'A11_homework_hint',
    prompt,
    modelTier: 'large',
  };
}

export function isOffTopic(question: string, subject: string): boolean {
  const blocked = [
    'politics', 'religion', 'siasa', 'dini',
    'violence', 'ukatili', 'adult', 'sex',
  ];
  const lower = question.toLowerCase();
  return blocked.some(b => lower.includes(b));
}
