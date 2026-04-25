/**
 * PII scrubber for AI prompt construction.
 * Replaces personal identifiers with stable placeholders before any content
 * leaves the API process for LLM inference. Placeholders are re-hydrated
 * server-side after the model response is received.
 *
 * PDPA 2022 compliance: student PII must never leave the af-south-1 region
 * in plaintext. This scrubber is the first defense layer.
 */

type PiiMap = Map<string, string>;

export interface ScrubResult {
  scrubbed: string;
  piiMap: PiiMap;
}

const PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(\+255|0)[67]\d{8}\b/g, label: 'PHONE' },
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, label: 'EMAIL' },
  { pattern: /\b\d{20}\b/g, label: 'NIDA' },                       // NIDA is 20 digits
  { pattern: /\b[A-Z]{2,5}\/\d{4}\/\d{3,5}\b/g, label: 'ADMISSION_NO' }, // e.g. GV/2024/001
];

let _counter = 0;

export function scrubPii(text: string): ScrubResult {
  const piiMap: PiiMap = new Map();
  let scrubbed = text;

  for (const { pattern, label } of PATTERNS) {
    scrubbed = scrubbed.replace(pattern, (match) => {
      // Check if we already have a placeholder for this exact value
      for (const [placeholder, original] of piiMap.entries()) {
        if (original === match) return placeholder;
      }
      const placeholder = `<${label}_${++_counter}>`;
      piiMap.set(placeholder, match);
      return placeholder;
    });
  }

  return { scrubbed, piiMap };
}

export function rehydratePii(text: string, piiMap: PiiMap): string {
  let result = text;
  for (const [placeholder, original] of piiMap.entries()) {
    result = result.replaceAll(placeholder, original);
  }
  return result;
}
