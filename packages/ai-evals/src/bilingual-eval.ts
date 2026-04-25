/**
 * Bilingual AI evaluation framework.
 * Runs the golden-set eval suite for each AI feature in both en-TZ and sw-TZ.
 *
 * Usage: run before every model upgrade and before any Swahili feature ships.
 * Results are tracked in a per-tenant dashboard; Swahili GA requires reviewer sign-off.
 *
 * Gate per Swahili feature:
 *  1. Run eval suite → must pass quality threshold (BLEU/ROUGE + human rating ≥ 4/5)
 *  2. Native Swahili reviewer sign-off
 *  3. Product manager approval
 */

export type FeatureCode = string;
export type EvalLocale = 'en-TZ' | 'sw-TZ';

export interface EvalCase {
  id: string;
  featureCode: FeatureCode;
  locale: EvalLocale;
  input: Record<string, unknown>;
  /** Expected keywords or phrases that should appear in a good response */
  mustContain?: string[];
  /** Phrases that must NOT appear (safety/quality guard) */
  mustNotContain?: string[];
  /** Human-rated gold standard response (for BLEU comparison) */
  goldResponse?: string;
  /** Minimum acceptable quality score 0-1 */
  threshold: number;
}

export interface EvalResult {
  caseId: string;
  featureCode: FeatureCode;
  locale: EvalLocale;
  passed: boolean;
  score: number;
  failureReasons: string[];
  latencyMs: number;
  model: string;
  runAt: string;
}

export interface EvalSuiteResult {
  featureCode: FeatureCode;
  locale: EvalLocale;
  totalCases: number;
  passed: number;
  failed: number;
  passRate: number;
  avgScore: number;
  avgLatencyMs: number;
  swahiliReviewerRequired: boolean;
  readyForGa: boolean;
}

/** Minimal BLEU-1 score for single-sentence outputs */
export function bleu1(hypothesis: string, reference: string): number {
  const hypTokens = new Set(hypothesis.toLowerCase().split(/\s+/));
  const refTokens = reference.toLowerCase().split(/\s+/);
  const matches = refTokens.filter(t => hypTokens.has(t)).length;
  return refTokens.length > 0 ? matches / refTokens.length : 0;
}

export function evaluateResponse(
  evalCase: EvalCase,
  response: string,
  latencyMs: number,
  model: string,
): EvalResult {
  const failures: string[] = [];
  let score = 1.0;

  // Check mustContain
  for (const keyword of evalCase.mustContain ?? []) {
    if (!response.toLowerCase().includes(keyword.toLowerCase())) {
      failures.push(`Missing required keyword: "${keyword}"`);
      score -= 0.2;
    }
  }

  // Check mustNotContain
  for (const banned of evalCase.mustNotContain ?? []) {
    if (response.toLowerCase().includes(banned.toLowerCase())) {
      failures.push(`Contains banned phrase: "${banned}"`);
      score -= 0.4;
    }
  }

  // BLEU-1 against gold response
  if (evalCase.goldResponse) {
    const bleu = bleu1(response, evalCase.goldResponse);
    if (bleu < 0.3) {
      failures.push(`Low BLEU-1 score: ${bleu.toFixed(2)} (threshold 0.30)`);
      score = Math.min(score, bleu + 0.2);
    }
  }

  score = Math.max(0, Math.min(1, score));
  const passed = score >= evalCase.threshold && failures.length === 0;

  return {
    caseId: evalCase.id,
    featureCode: evalCase.featureCode,
    locale: evalCase.locale,
    passed,
    score,
    failureReasons: failures,
    latencyMs,
    model,
    runAt: new Date().toISOString(),
  };
}

export function summariseSuite(results: EvalResult[], locale: EvalLocale): EvalSuiteResult {
  const passed = results.filter(r => r.passed).length;
  const avgScore = results.reduce((s, r) => s + r.score, 0) / (results.length || 1);
  const avgLatency = results.reduce((s, r) => s + r.latencyMs, 0) / (results.length || 1);
  const passRate = results.length > 0 ? passed / results.length : 0;

  const GA_THRESHOLD = locale === 'sw-TZ' ? 0.85 : 0.80;

  return {
    featureCode: results[0]?.featureCode ?? 'unknown',
    locale,
    totalCases: results.length,
    passed,
    failed: results.length - passed,
    passRate,
    avgScore,
    avgLatencyMs: avgLatency,
    swahiliReviewerRequired: locale === 'sw-TZ',
    readyForGa: passRate >= GA_THRESHOLD,
  };
}
