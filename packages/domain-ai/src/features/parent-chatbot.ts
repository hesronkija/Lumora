/**
 * A4: Parent Chatbot
 * Phase 5 — bilingual (en-TZ + sw-TZ), WhatsApp + in-app.
 * RAG over tenant's own data only (fees, grades, timetable, announcements).
 *
 * Design constraints:
 *  - Auto-responds to FAQ; escalates ambiguous to human (comms module)
 *  - Strict RAG scope: only tenant's approved knowledge base
 *  - Guardrails block: individual student PII to wrong parent, financial advice,
 *    medical advice, off-topic, jailbreaks
 *  - Swahili: gated on native-reviewer sign-off before GA
 *
 * PDPA: conversation IDs stored, message bodies purged after 90 days.
 */

import { scrubPii } from '../pii/scrubber';
import type { AiGatewayRequest } from '../gateway/types';

export type ChatLocale = 'en-TZ' | 'sw-TZ';
export type ChatChannel = 'whatsapp' | 'in_app';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatContext {
  tenantId: string;
  parentId: string;
  childrenIds: string[];
  locale: ChatLocale;
  channel: ChatChannel;
  /** RAG snippets injected from the tenant knowledge base */
  ragSnippets: string[];
}

const SYSTEM_PROMPT = (ctx: ChatContext) => `You are a helpful school assistant for a parent.
Language: ${ctx.locale === 'sw-TZ' ? 'Kiswahili sanifu (formal Tanzanian Swahili)' : 'Clear, friendly Tanzanian English'}.
Channel: ${ctx.channel}.

STRICT RULES:
- Only answer questions about this school's fees, schedule, grades, and announcements.
- Never share another student's information.
- For medical or legal questions, advise the parent to contact the school directly.
- If you don't know the answer, say so and offer to escalate to a school staff member.
- Keep responses under 300 words (${ctx.channel === 'whatsapp' ? '160 chars for SMS fallback' : 'in-app has more space'}).
- Never invent fee amounts, dates, or grades — only state what is in the context below.

SCHOOL KNOWLEDGE BASE:
${ctx.ragSnippets.join('\n\n')}`;

export function buildChatPrompt(
  ctx: ChatContext,
  history: ChatMessage[],
  userMessage: string,
): { request: Omit<AiGatewayRequest, 'tenantId' | 'userId'>; scrubbed: string } {
  const { scrubbed } = scrubPii(userMessage);

  // Keep last 6 turns (3 exchanges) for context window economy
  const recentHistory = history.slice(-6);

  const conversationText = recentHistory
    .map(m => `${m.role === 'user' ? 'Parent' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const prompt = `${SYSTEM_PROMPT(ctx)}

CONVERSATION:
${conversationText}
Parent: ${scrubbed}
Assistant:`;

  return {
    request: {
      featureCode: 'A4_parent_chatbot',
      prompt,
      modelTier: 'large',
    },
    scrubbed,
  };
}

export function shouldEscalate(response: string): boolean {
  const escalationSignals = [
    "i don't know", "i'm not sure", "please contact", "speak to",
    "sijui", "siwezi", "wasiliana na", // Swahili
    'cannot help', 'unable to', 'beyond my',
  ];
  const lower = response.toLowerCase();
  return escalationSignals.some(sig => lower.includes(sig));
}
