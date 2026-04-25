/**
 * A10: Admissions Interview Summarizer
 * Phase 5, gated.
 *
 * Converts a structured interview audio (recorded with explicit consent)
 * into a concise set of notes for the admissions officer.
 * Interviewer edits and saves — AI draft never auto-submitted.
 *
 * PII: audio processed in-region via Whisper; transcript scrubbed before LLM prompt.
 * Consent: captured in ai_consent table before any recording starts.
 */

import { scrubPii, rehydratePii } from '../pii/scrubber';
import type { AiGatewayRequest, AiGatewayResponse } from '../gateway/types';

export interface InterviewSummaryRequest {
  transcript: string;
  applicantName: string;    // for context only — scrubbed in prompt
  applyingForClass: string;
  locale: 'en-TZ' | 'sw-TZ';
}

export interface InterviewSummaryResult {
  academicReadiness: string;
  communicationSkills: string;
  familyBackground: string;
  concerns: string;
  recommendation: 'strong_offer' | 'offer' | 'waitlist' | 'decline' | 'unclear';
  overallNotes: string;
}

export function buildInterviewPrompt(
  req: InterviewSummaryRequest,
): { request: Omit<AiGatewayRequest, 'tenantId' | 'userId'>; piiMap: Map<string, string> } {
  const combined = `Applicant: ${req.applicantName}\nApplying for: ${req.applyingForClass}\n\n${req.transcript}`;
  const { scrubbed, piiMap } = scrubPii(combined);

  const langInstruction = req.locale === 'sw-TZ'
    ? 'Write in formal Kiswahili sanifu.'
    : 'Write in formal Tanzanian English.';

  const prompt = `You are summarizing an admissions interview for a primary school.
${langInstruction}

INTERVIEW TRANSCRIPT:
${scrubbed}

Summarise in JSON with these exact keys:
{
  "academicReadiness": "1-2 sentences on academic background and readiness",
  "communicationSkills": "1 sentence on verbal communication observed",
  "familyBackground": "1 sentence on family context shared (non-sensitive only)",
  "concerns": "Any red flags or areas needing follow-up (or 'None noted')",
  "recommendation": "one of: strong_offer | offer | waitlist | decline | unclear",
  "overallNotes": "2-3 sentences overall impression"
}`;

  return {
    request: { featureCode: 'A10_interview_summary', prompt, modelTier: 'large' },
    piiMap,
  };
}

export function parseInterviewResponse(
  response: AiGatewayResponse,
  piiMap: Map<string, string>,
): InterviewSummaryResult | null {
  try {
    const raw = JSON.parse(response.output) as InterviewSummaryResult;
    return {
      academicReadiness: rehydratePii(raw.academicReadiness, piiMap),
      communicationSkills: rehydratePii(raw.communicationSkills, piiMap),
      familyBackground: rehydratePii(raw.familyBackground, piiMap),
      concerns: rehydratePii(raw.concerns, piiMap),
      recommendation: raw.recommendation,
      overallNotes: rehydratePii(raw.overallNotes, piiMap),
    };
  } catch {
    return null;
  }
}
