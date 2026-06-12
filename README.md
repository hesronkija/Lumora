# Lumora — Shule Bora 🇹🇿

**A multi-tenant school management system for Tanzanian schools** — admissions,
academics, attendance, exams, fees with mobile-money collection, double-entry
accounting, statutory payroll, boarding, transport, parent communications and
local-first AI. English and Kiswahili throughout.

## Quick start (zero backend — see it in 60 seconds)

```bash
pnpm install
pnpm --filter @lumora/admin-web dev
# open http://localhost:3001 — full demo school, no database needed
```

The admin app ships with **demo mode**: when `NEXT_PUBLIC_API_URL` is not set
it renders a complete demo school (Green Valley Primary, 84 students, fees,
payroll, exam results, AI assistant) entirely in the browser. Toggle
English ⇄ Kiswahili from the topbar.

## Full stack (API + Postgres + Keycloak)

```bash
cp .env.example .env
docker compose up -d postgres redis keycloak mailhog
pnpm --filter @lumora/api migrate:latest   # uses DATABASE_URL_ADMIN
pnpm --filter @lumora/api seed:run         # demo tenant + living school data
pnpm --filter @lumora/api dev              # http://localhost:3000 (Swagger at /docs)
NEXT_PUBLIC_API_URL=http://localhost:3000 pnpm --filter @lumora/admin-web dev
```

**Two database roles, on purpose:**

| Env var | Role | Used by |
|---|---|---|
| `DATABASE_URL` | `lumora_app` (non-superuser) | the API at runtime — Postgres **Row-Level Security enforces tenant isolation** |
| `DATABASE_URL_ADMIN` | schema owner | migrations & seeds only |

Never point the API at a superuser: superusers bypass RLS.

## Tests

```bash
pnpm --filter @lumora/api test       # 61 unit tests — payroll statutory math,
                                     # double-entry, control numbers, webhook
                                     # signatures, tenant-pool wrappers, AI engines
TEST_DATABASE_URL=postgres://...     # + live-Postgres RLS isolation suite
pnpm --filter @lumora/api test
```

## What's inside

| Area | Highlights |
|---|---|
| **Payments** | M-Pesa/Tigo/Airtel via Selcom, NMB & CRDB billers, GePG, cash with dual control. Luhn-validated control numbers, HMAC-verified webhooks, replay protection, nightly reconciliation, TRA VFD fiscal receipts. |
| **Money** | Double-entry GL (DR=CR enforced), accounting periods, budgets. Payroll: PAYE brackets, NSSF/PSSSF, SDL, WCF, HESLB — every rate versioned in `statutory_rate`, never hardcoded. |
| **Academics** | Admissions pipeline, enrollment, attendance (offline-first mobile), exams with auto-ranked report cards, NECTA PSLE & TAMISEMI BEMIS exports. |
| **AI (local-first)** | Report-comment drafts, announcement drafts, bilingual parent assistant grounded only in the asking parent's children, at-risk early warning. Works with zero GPU via deterministic engines; upgrades to in-region vLLM with PII scrubbing when `AI_GATEWAY_URL` is set. Humans approve every draft. |
| **Security** | Postgres RLS with `FORCE` on every tenant table (fail-closed pool wrappers), append-only audit log enforced at the DB, MFA via Keycloak, PDPA 2022 consent ledger. |

## Repository layout

```
apps/
  api/          NestJS API — 18 modules, 17 migrations, seeds, tests
  admin-web/    Next.js admin (17 pages, EN/SW, demo mode)
  parent-web/   Parent portal (scaffold)
  mobile-*/     React Native teacher & parent apps (scaffold)
packages/
  shared-tenancy/  RLS pool wrappers + tenant context (the security core)
  shared-auth/     JWT verification, roles
  domain-ai/       AI features: prompts, PII scrubber, at-risk scoring
  shared-i18n/     Locale catalogs
docs/            OPERATIONS.md · ADRs · runbooks · DPIA
infra/           Terraform, Helm, docker init, observability
```

See **docs/OPERATIONS.md** for the full how-to-run-and-operate guide.
