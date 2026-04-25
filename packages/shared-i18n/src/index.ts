export { enTZ } from './catalogs/en-TZ';
export { swTZ } from './catalogs/sw-TZ';
export type { I18nKey } from './catalogs/en-TZ';

export type Locale = 'en-TZ' | 'sw-TZ';

import { enTZ } from './catalogs/en-TZ';
import { swTZ } from './catalogs/sw-TZ';

const catalogs = { 'en-TZ': enTZ, 'sw-TZ': swTZ } as const;

/** Runtime locale resolver — falls back to en-TZ if key missing in sw-TZ */
export function t(locale: Locale, key: string): string {
  const catalog = catalogs[locale] as Record<string, unknown>;
  const fallback = catalogs['en-TZ'] as Record<string, unknown>;
  const parts = key.split('.');
  let val: unknown = catalog;
  let fb: unknown = fallback;
  for (const part of parts) {
    val = (val as Record<string, unknown>)?.[part];
    fb = (fb as Record<string, unknown>)?.[part];
  }
  return (typeof val === 'string' ? val : typeof fb === 'string' ? fb : key);
}
