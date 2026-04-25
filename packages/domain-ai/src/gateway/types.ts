export type AiFeatureCode =
  | 'A1_report_card_comments'
  | 'A2_at_risk_warning'
  | 'A3_payment_recon_assist'
  | 'A4_parent_chatbot'
  | 'A5_ocr_document_intake'
  | 'A6_voice_to_text'
  | 'A7_accounting_anomaly'
  | 'A8_announcement_draft'
  | 'A9_timetable_solver'
  | 'A10_interview_summary'
  | 'A11_homework_hint';

export type AiRequestStatus = 'drafted' | 'human_accepted' | 'human_rejected' | 'edited';

export interface AiGatewayRequest {
  featureCode: AiFeatureCode;
  tenantId: string;
  userId: string;
  prompt: string;
  systemPrompt?: string;
  modelTier?: 'large' | 'small';
}

export interface AiGatewayResponse {
  requestId: string;
  generationId: string;
  output: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  model: string;
  safetyFlags: string[];
}

export interface AiCostEntry {
  tenantId: string;
  period: string; // YYYY-MM
  featureCode: AiFeatureCode;
  tokens: number;
  tzsCost: number;
}
