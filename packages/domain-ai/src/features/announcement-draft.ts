/**
 * A8: Auto-drafted Announcements
 * Phase 2 beta — English only; Swahili after Phase 5 linguistic sign-off.
 *
 * Headteacher provides intent in plain language.
 * LLM produces a concise, parent-appropriate announcement for SMS/WhatsApp.
 * Human must edit and explicitly send — never auto-dispatched.
 *
 * PII: only used for bulk non-PII announcements.
 * Single-student messages use template-based comms, not this feature.
 */

import type { AiGatewayRequest } from '../gateway/types';

export interface AnnouncementDraftRequest {
  tenantName: string;
  intent: string; // Free-text from headteacher: "remind parents fees are due Friday"
  channel: 'sms' | 'whatsapp' | 'email';
  locale: 'en-TZ'; // Swahili ('sw-TZ') added in Phase 5
  maxLength?: number; // SMS: 160 chars; WhatsApp: 1600
}

export interface AnnouncementDraftResult {
  draft: string;
  charCount: number;
  withinLimit: boolean;
}

const CHANNEL_LIMITS: Record<string, number> = {
  sms: 160,
  whatsapp: 1600,
  email: 4000,
};

export function buildAnnouncementPrompt(
  req: AnnouncementDraftRequest,
): Omit<AiGatewayRequest, 'tenantId' | 'userId'> {
  const limit = req.maxLength ?? CHANNEL_LIMITS[req.channel] ?? 160;

  const prompt = `You are drafting an official school announcement for ${req.tenantName}.

Channel: ${req.channel} (max ${limit} characters)
Language: English (Tanzanian formal register)
Tone: Clear, professional, respectful — appropriate for Tanzanian parents.

Headteacher's intent:
"${req.intent}"

Write ONLY the announcement text. No preamble, no explanation.
Must be within ${limit} characters.
Do not include student names, individual fee amounts, or any personal information.`;

  return {
    featureCode: 'A8_announcement_draft',
    prompt,
    modelTier: 'large',
  };
}

export function parseAnnouncementResponse(
  output: string,
  channel: string,
  maxLength?: number,
): AnnouncementDraftResult {
  const limit = maxLength ?? CHANNEL_LIMITS[channel] ?? 160;
  const draft = output.trim();
  return {
    draft,
    charCount: draft.length,
    withinLimit: draft.length <= limit,
  };
}
