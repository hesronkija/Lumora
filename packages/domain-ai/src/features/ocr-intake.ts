/**
 * A5: OCR Document Intake
 * Phase 1 — human-confirm mode only.
 * OCR runs via PaddleOCR/docTR (services/inference-ocr).
 * This module defines the contract; Phase 1 ships with a stub that returns
 * the raw OCR text for a human to confirm field by field.
 */

export interface OcrDocumentRequest {
  s3Key: string;
  docType: 'birth_cert' | 'nida_card' | 'transcript' | 'passport' | 'other';
  tenantId: string;
}

export interface OcrExtractedFields {
  fullName?: string;
  dateOfBirth?: string;
  gender?: string;
  documentNumber?: string;
  rawText?: string;
  confidence?: number; // 0-1
  needsHumanReview: boolean;
}

export async function extractDocumentFields(
  req: OcrDocumentRequest,
): Promise<OcrExtractedFields> {
  // Phase 1 stub — returns raw text marker for human to fill in manually.
  // Phase 3+ will call the inference-ocr service via HTTP.
  return {
    rawText: `[OCR stub] Document: ${req.s3Key} (${req.docType}) — awaiting inference service`,
    needsHumanReview: true,
    confidence: 0,
  };
}
