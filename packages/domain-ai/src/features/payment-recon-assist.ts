/**
 * A3: Payment Reconciliation Assist
 * Phase 2 — bursar-confirm mode.
 *
 * Given an unmatched external receipt (from telco/bank settlement) and a set
 * of open invoices, the LLM suggests the most likely match.
 * The bursar must confirm every suggestion before any payment record changes.
 *
 * PII handling: names/phones are scrubbed before prompting; re-hydrated for display.
 * Local-model-first: runs via the in-region AI gateway (vLLM small-tier).
 */

import { scrubPii, rehydratePii } from '../pii/scrubber';
import type { AiGatewayRequest, AiGatewayResponse } from '../gateway/types';

export interface UnmatchedReceipt {
  externalRef: string;
  amount: number; // TZS integer
  payerPhone?: string;
  payerName?: string;
  txnDate: string; // ISO
  source: string; // 'selcom' | 'nmb' | ...
}

export interface OpenInvoiceCandidate {
  invoiceId: string;
  invoiceNo: string;
  studentName: string;
  controlNo: string;
  totalDue: number;
  totalPaid: number;
  guardianPhone?: string;
}

export interface ReconSuggestion {
  invoiceId: string;
  invoiceNo: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export function buildReconPrompt(
  receipt: UnmatchedReceipt,
  candidates: OpenInvoiceCandidate[],
): { request: Omit<AiGatewayRequest, 'tenantId' | 'userId'>; piiMap: Map<string, string> } {
  const receiptText = [
    `External ref: ${receipt.externalRef}`,
    `Amount: TZS ${receipt.amount.toLocaleString()}`,
    `Payer phone: ${receipt.payerPhone ?? 'unknown'}`,
    `Payer name: ${receipt.payerName ?? 'unknown'}`,
    `Date: ${receipt.txnDate}`,
    `Source: ${receipt.source}`,
  ].join('\n');

  const { scrubbed: scrubbedReceipt, piiMap } = scrubPii(receiptText);

  const candidateLines = candidates.map((c, i) => {
    const line = [
      `${i + 1}. Invoice ${c.invoiceNo} (${c.invoiceId})`,
      `   Student: ${c.studentName}`,
      `   Control No: ${c.controlNo}`,
      `   Outstanding: TZS ${(c.totalDue - c.totalPaid).toLocaleString()}`,
      `   Guardian phone: ${c.guardianPhone ?? 'none on file'}`,
    ].join('\n');
    const { scrubbed, piiMap: localMap } = scrubPii(line);
    localMap.forEach((v, k) => piiMap.set(k, v));
    return scrubbed;
  }).join('\n\n');

  const prompt = `You are helping a school bursar match an unidentified payment receipt to the correct student invoice.

RECEIPT:
${scrubbedReceipt}

OPEN INVOICES (candidates):
${candidateLines}

Task: Identify which invoice (if any) this receipt most likely belongs to. Consider:
- Phone number similarity (same prefix, transposed digits)
- Amount closeness (partial payment, rounding)
- Name phonetic similarity

Respond in JSON: {"invoiceId": "<id or null>", "confidence": "high|medium|low", "reasoning": "<brief explanation>"}
If no candidate is a plausible match, set invoiceId to null.`;

  return {
    request: {
      featureCode: 'A3_payment_recon_assist',
      prompt,
      modelTier: 'small',
    },
    piiMap,
  };
}

export function parseReconResponse(
  response: AiGatewayResponse,
  piiMap: Map<string, string>,
): ReconSuggestion | null {
  try {
    const json = JSON.parse(response.output) as {
      invoiceId: string | null;
      confidence: 'high' | 'medium' | 'low';
      reasoning: string;
    };
    if (!json.invoiceId) return null;
    return {
      invoiceId: json.invoiceId,
      invoiceNo: '',
      confidence: json.confidence,
      reasoning: rehydratePii(json.reasoning, piiMap),
    };
  } catch {
    return null;
  }
}
