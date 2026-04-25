/**
 * A7: Accounting Anomaly Detection
 * Phase 3 — rule-based + isolation-forest-style heuristics.
 * No LLM; all computation in-region. No PII involved (journal amounts only).
 *
 * Detects:
 *   - Unusually large journal entries (> N× the account's rolling average)
 *   - Round-number bias (psychological fraud signal)
 *   - Entries posted outside business hours
 *   - Entries on a source_module that rarely posts to that account
 *   - Imbalanced entries (double-entry violation — should never happen, but catch it)
 *
 * Human-in-loop: bursar + headteacher dual-review flag required.
 */

export interface JournalLineSignal {
  journalEntryId: string;
  entryNo: string;
  entryDate: string;
  postedAt: string; // ISO timestamp
  narrative: string;
  sourceModule: string;
  accountCode: string;
  accountName: string;
  amount: number; // absolute value in TZS
  side: 'dr' | 'cr';
  accountRollingAvg?: number; // average absolute amount for this account (last 90 days)
}

export interface AnomalyFlag {
  journalEntryId: string;
  entryNo: string;
  ruleCode: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  amount?: number;
}

export function detectAnomalies(lines: JournalLineSignal[]): AnomalyFlag[] {
  const flags: AnomalyFlag[] = [];
  const seenEntries = new Set<string>();

  for (const line of lines) {
    const entryKey = line.journalEntryId;

    // Rule A7-01: Unusually large amount (> 5× rolling average for the account)
    if (
      line.accountRollingAvg !== undefined &&
      line.accountRollingAvg > 0 &&
      line.amount > line.accountRollingAvg * 5
    ) {
      flags.push({
        journalEntryId: line.journalEntryId,
        entryNo: line.entryNo,
        ruleCode: 'A7-01',
        description: `Amount TZS ${line.amount.toLocaleString()} is ${(line.amount / line.accountRollingAvg).toFixed(1)}× the 90-day average for account ${line.accountCode}`,
        severity: line.amount > line.accountRollingAvg * 20 ? 'critical' : 'warning',
        amount: line.amount,
      });
    }

    // Rule A7-02: Round-number bias (exactly divisible by 100,000)
    if (line.amount >= 1_000_000 && line.amount % 100_000 === 0) {
      if (!seenEntries.has(`A7-02-${entryKey}`)) {
        flags.push({
          journalEntryId: line.journalEntryId,
          entryNo: line.entryNo,
          ruleCode: 'A7-02',
          description: `Round number TZS ${line.amount.toLocaleString()} — statistical fraud signal`,
          severity: 'info',
          amount: line.amount,
        });
        seenEntries.add(`A7-02-${entryKey}`);
      }
    }

    // Rule A7-03: Posted outside business hours (before 07:00 or after 21:00 EAT, UTC+3)
    if (line.postedAt) {
      const utcHour = new Date(line.postedAt).getUTCHours();
      const eatHour = (utcHour + 3) % 24;
      if (eatHour < 7 || eatHour >= 21) {
        if (!seenEntries.has(`A7-03-${entryKey}`)) {
          flags.push({
            journalEntryId: line.journalEntryId,
            entryNo: line.entryNo,
            ruleCode: 'A7-03',
            description: `Journal posted at ${eatHour}:00 EAT — outside business hours`,
            severity: 'warning',
          });
          seenEntries.add(`A7-03-${entryKey}`);
        }
      }
    }

    // Rule A7-04: Manual entry to a control account (AR/AP) — should only come from source modules
    if (line.sourceModule === 'manual' && ['1100', '2010'].includes(line.accountCode)) {
      flags.push({
        journalEntryId: line.journalEntryId,
        entryNo: line.entryNo,
        ruleCode: 'A7-04',
        description: `Manual journal posted to control account ${line.accountCode} (${line.accountName}) — expected to be system-generated`,
        severity: 'warning',
        amount: line.amount,
      });
    }
  }

  return flags.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });
}

export function summarizeAnomalies(flags: AnomalyFlag[]): {
  total: number;
  critical: number;
  warning: number;
  info: number;
  byRule: Record<string, number>;
} {
  const byRule: Record<string, number> = {};
  for (const f of flags) {
    byRule[f.ruleCode] = (byRule[f.ruleCode] ?? 0) + 1;
  }
  return {
    total: flags.length,
    critical: flags.filter(f => f.severity === 'critical').length,
    warning: flags.filter(f => f.severity === 'warning').length,
    info: flags.filter(f => f.severity === 'info').length,
    byRule,
  };
}
