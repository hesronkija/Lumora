# Lumora — Operations Guide

How to run, operate and extend the system. Written for whoever inherits this
repo next.

## 1. Local development

### Option A — UI only (no backend)
```bash
pnpm install
pnpm --filter @lumora/admin-web dev    # http://localhost:3001
```
Demo mode is automatic when `NEXT_PUBLIC_API_URL` is unset. Every page works:
dashboard, students, fees, payroll, AI assistant (EN + SW).

### Option B — full stack
```bash
cp .env.example .env                   # defaults work with docker compose
docker compose up -d postgres redis keycloak mailhog
pnpm --filter @lumora/api migrate:latest
pnpm --filter @lumora/api seed:run
pnpm --filter @lumora/api dev          # API on :3000, Swagger at /docs
NEXT_PUBLIC_API_URL=http://localhost:3000 pnpm --filter @lumora/admin-web dev
```

Docker's `postgres-init.sql` creates the `lumora_app` non-superuser login.
The API **must** connect as that role (`DATABASE_URL`); migrations connect as
the owner (`DATABASE_URL_ADMIN`).

## 2. The security model (read this before touching DB code)

- Every tenant table has **RLS enabled + FORCED** (migration 016). The policy
  passes only when `app.current_tenant_id` matches, or `app.is_system='on'`.
- Application code never sets those GUCs by hand. Inject:
  - `DB_POOL` → `TenantAwarePool` — sets the GUC per query/connection,
    **throws outside a tenant context** (fail closed). Use everywhere.
  - `DB_POOL_SYSTEM` → `SystemPool` — deliberate cross-tenant access for
    webhooks, provisioning, health checks. Grep for it in review; every use
    must justify itself.
- Background jobs use `runAsTenant(tenantId, fn)` so RLS still applies.
- `audit_log` is append-only **at the database**: no UPDATE/DELETE policy
  exists, so even system code cannot rewrite history.
- Payment webhooks: HMAC-SHA256 over the raw body, constant-time compare,
  fail-closed in production, replay-protected by provider ref + idempotency
  key. Secrets: `SELCOM_API_SECRET`, `NMB_/CRDB_WEBHOOK_SECRET`,
  `GEPG_WEBHOOK_SECRET`.

## 3. Tests

```bash
pnpm --filter @lumora/api test                      # unit (no DB)
TEST_DATABASE_URL=postgres://owner@host/db \
  pnpm --filter @lumora/api test                    # + RLS integration suite
```
The RLS suite creates a non-superuser login and proves: tenant A cannot read,
write or update tenant B; empty context sees zero rows; audit log is
immutable; system context works for webhook resolution.

## 4. Payroll statutory rates

Rates live in the `statutory_rate` table, versioned by `effective_from` —
**never hardcode them**. When a Finance Act changes PAYE:

```sql
UPDATE statutory_rate SET effective_to = '2027-06-30'
 WHERE rate_type = 'paye_bracket' AND effective_to IS NULL;
INSERT INTO statutory_rate (rate_type, effective_from, config, source)
VALUES ('paye_bracket', '2027-07-01', '[...new brackets...]', 'Finance Act 2027');
```
Old payroll runs keep computing with the rates valid for their period.

## 5. Payment provider onboarding

| Provider | Env vars | Notes |
|---|---|---|
| Selcom (M-Pesa/Tigo/Airtel) | `SELCOM_API_KEY`, `SELCOM_API_SECRET` | commercial agreement; webhook auto-verifies |
| NMB / CRDB | `BANK_API_KEY`, `NMB_/CRDB_WEBHOOK_SECRET` | separate contracts per bank |
| GePG | `GEPG_SP_CODE`, `GEPG_WEBHOOK_SECRET` | MoF onboarding, multi-week lead time — required for public schools |
| TRA VFMS | `VFMS_API_KEY` + tenant VRN | fiscal receipts auto-issue once the tenant has a VRN |

Without credentials every adapter runs in **stub mode** — safe for dev,
logged loudly.

## 6. AI features

All features work without a GPU (deterministic engines). To enable LLM
generation set `AI_GATEWAY_URL` to the in-region vLLM gateway. PII is
scrubbed before any prompt leaves the process; every generation is logged to
`ai_request`; nothing reaches a parent or report card without explicit human
approval. Endpoints: `POST /ai/report-comment`, `POST /ai/announcement`,
`POST /ai/parent-chat`, `GET /reporting/at-risk`.

## 7. Production posture

- Region: AWS `af-south-1` + on-shore DR (PDPA residency).
- The API connects as `lumora_app` (no superuser, no BYPASSRLS — verify with
  `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`).
- Keycloak enforces MFA for money-touching roles.
- Reconciliation runs nightly per tenant (`apps/workers`); ambiguous matches
  go to the bursar queue in the admin UI.
- Observability: OTel traces + Pino structured logs with PII scrubbing.

## 8. CI

`.github/workflows/ci.yml` — typecheck + unit tests + admin build on every
push/PR; the RLS integration suite runs against a Postgres service container.
