/**
 * WatermelonDB offline-first sync layer.
 * Model: server-authoritative timestamps; conflict = server wins for money/grades.
 *
 * Sync cadence:
 *  - On app foreground: pull changes since last_synced_at
 *  - On payment/message action: immediate push then pull
 *  - Background sync every 15 min (when connected)
 */

import { Database } from '@nozbe/watermelondb';

export interface SyncOptions {
  db: Database;
  apiBaseUrl: string;
  authToken: string;
  tenantId: string;
  parentId: string;
}

export interface SyncResult {
  pulled: number;
  pushed: number;
  conflicts: number;
  lastSyncedAt: string;
}

export async function synchronize(opts: SyncOptions): Promise<SyncResult> {
  const { synchronize: wmSync } = await import('@nozbe/watermelondb/sync');

  let pulled = 0;
  let pushed = 0;
  let conflicts = 0;

  await wmSync({
    database: opts.db,

    pullChanges: async ({ lastPulledAt }) => {
      const url = `${opts.apiBaseUrl}/v1/sync/pull?lastPulledAt=${lastPulledAt ?? 0}` +
        `&tenantId=${opts.tenantId}&parentId=${opts.parentId}`;

      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${opts.authToken}` },
      });
      if (!resp.ok) throw new Error(`Sync pull failed: ${resp.status}`);

      const data = (await resp.json()) as {
        changes: Record<string, unknown>;
        timestamp: number;
      };
      pulled = Object.values(data.changes).reduce(
        (s, c) => s + ((c as { created?: unknown[] }).created?.length ?? 0) +
          ((c as { updated?: unknown[] }).updated?.length ?? 0),
        0,
      );
      return { changes: data.changes, timestamp: data.timestamp };
    },

    pushChanges: async ({ changes }) => {
      const resp = await fetch(`${opts.apiBaseUrl}/v1/sync/push`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ changes, tenantId: opts.tenantId, parentId: opts.parentId }),
      });

      if (!resp.ok) throw new Error(`Sync push failed: ${resp.status}`);
      const result = (await resp.json()) as { pushed: number; conflicts: number };
      pushed = result.pushed;
      conflicts = result.conflicts;
    },

    // Server wins on conflict (money, grades are authoritative server-side)
    conflictResolver: (_table, local, remote) => remote,
  });

  return {
    pulled,
    pushed,
    conflicts,
    lastSyncedAt: new Date().toISOString(),
  };
}
