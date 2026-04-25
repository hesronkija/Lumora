# ADR-002: Money Representation

**Status:** Accepted
**Date:** 2026-04-23

## Decision

- Postgres: `numeric(18,4)` — never `float` or `double precision`
- TypeScript: `Decimal.js` for all arithmetic; never `number` for monetary values
- Serialized over API as **string** (JSON loses precision on large integers)
- Currency: TZS only at launch; schema carries a `currency` column set to `TZS` for future multi-currency

## Why

`float` arithmetic: `0.1 + 0.2 = 0.30000000000000004`. For a school fee ledger, a rounding error of TZS 0.01 per record will corrupt the double-entry invariant and create unexplainable discrepancies during TRA audits.

## Consequences

- `Decimal.js` bundle in TypeScript packages that do arithmetic
- API consumers must parse monetary strings — documented in OpenAPI as `string` with `format: decimal`
