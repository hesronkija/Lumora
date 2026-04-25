# Soma — Knowledge Base

> **The name.** See §1.

---

## Table of Contents

1. [Product Name & Brand](#1-product-name--brand)
2. [What This Is](#2-what-this-is)
3. [Who It's For](#3-who-its-for)
4. [System Architecture](#4-system-architecture)
5. [Module Reference](#5-module-reference)
6. [Data Model Primer](#6-data-model-primer)
7. [Multi-Tenancy & Security](#7-multi-tenancy--security)
8. [Payment Rails](#8-payment-rails)
9. [Accounting & Payroll](#9-accounting--payroll)
10. [AI Features](#10-ai-features)
11. [Mobile Apps](#11-mobile-apps)
12. [Compliance & Regulatory](#12-compliance--regulatory)
13. [Environments & Config](#13-environments--config)
14. [Codebase Map](#14-codebase-map)
15. [Key Decisions Log](#15-key-decisions-log)
16. [Roadmap Status](#16-roadmap-status)
17. [Open Questions](#17-open-questions)

---

## 1. Product Name & Brand

### The name: **Soma**

**"Soma"** is the Swahili imperative for *"read"* and *"study"* — the most direct command in the Tanzanian school system. Every teacher says it. Every student hears it. Every parent hopes for it.

> *Soma.* Study. Learn. Grow.

It works on three levels:

| Layer | Meaning |
|---|---|
| **Swahili** | *Soma* = "Read / Study" — imperative form. Authentic to Tanzania, immediately understood by every Tanzanian. |
| **Brand** | A call to action, not a description. Confident. Short. Memorable. Works as a domain (`soma.tz`, `somaschool.co.tz`), an app name, and a company name. |
| **Greek root** | *Soma* = "body" — the whole organism. Implies a complete, unified system rather than another point-solution. |

**Taglines to test:**

- *"Soma. Tanzania's school in one system."*
- *"Soma. From fees to finals."*
- *"Soma. Run your school. Empower your students."*
- *"Soma — elimu bila msumbuko."* (Education without the hassle.)

**Logo direction:** The Swahili letter "S" stylised as an open book or a single arc of light — clean, modern, works at 16px favicon and billboard scale.

**Alternatives considered and why Soma wins:**

| Name | Swahili meaning | Why not |
|---|---|---|
| Elimu | Education | Generic — used by dozens of edtech orgs |
| Maarifa | Knowledge / wisdom | Beautiful but 4 syllables — harder for non-Swahili speakers |
| Zidi | To grow / exceed | Good but less viscerally connected to school |
| Hekima | Wisdom | Premium feel but abstract |
| Mwanga | Light | Poetic but harder to brand as software |
| **Soma** | **Study / Read** | **Wins: 2 syllables, imperative energy, universal recognition in TZ** |

---

## 2. What This Is

**Soma** is a cloud SaaS built specifically for Tanzanian schools — public primary (TAMISEMI) and private/international — that replaces the patchwork of Excel fee books, paper ledgers, WhatsApp parent groups, and disconnected payment channels with one compliant, integrated system.

**Core loop:**

```
Register student → Issue invoice → Collect fees (M-Pesa/bank/GePG/cash)
→ Reconcile → Post to ledger → Run payroll → Send report card to parent
```

Every step of that loop that previously required a different tool, a different person, or a phone call is now in Soma.

**What it is not:**

- Not a generic African edtech product ported to Tanzania — built ground-up for TZ regulatory requirements (GePG, TRA VFMS, NECTA, TAMISEMI BEMIS, PDPA 2022)
- Not just a fees collector — full double-entry accounting, payroll with statutory deductions, boarding, transport, meals
- Not a tool that sends student data to foreign AI APIs — local-model-first, PDPA-compliant by design

---

## 3. Who It's For

### Primary buyers (decision-makers)

| Segment | Decision-maker | Pain point Soma solves |
|---|---|---|
| **Private primary (day + boarding)** | Headteacher or school owner | Fee collection in Excel, no bank reconciliation, payroll errors, no parent communication system |
| **International school (Dar/Arusha)** | Business manager / proprietor | Compliance gap (PDPA, TRA VFD receipts), multi-currency future, parent portal expectations |
| **Public primary (TAMISEMI)** | Ward/district education officer or head teacher | GePG fee collection mandated by govt, BEMIS reporting, NECTA candidate export |

### Daily users (people who actually log in)

| Role | What they do in Soma |
|---|---|
| **Bursar** | Issue invoices, record payments, reconcile daily, close month |
| **Headteacher** | Approve payroll, review at-risk dashboard, send announcements |
| **Accountant** | Post journals, run trial balance, prepare statutory returns |
| **HR / Admin** | Staff records, payroll data entry, leave management |
| **Class Teacher** | Mark attendance (web + mobile), enter grades |
| **Matron/Patron** | Dorm assignments, leave-out approvals, sick bay |
| **Parent** | View fees, pay via M-Pesa, see grades, get SMS alerts |
| **Auditor** | Read-only: journals, payroll, audit export |

---

## 4. System Architecture

```
  CloudFront / CDN
       │
  ┌────┴────────────────────────────────┐
  │  Next.js Admin (port 3001)          │
  │  Next.js Parent Web (port 3002)     │
  │  React Native Apps (Android-first)  │
  └────────────────┬────────────────────┘
                   │ HTTPS / JWT
  ┌────────────────▼────────────────────┐
  │  NestJS API  (port 3000)            │
  │  /api/v1/*   OpenAPI / Swagger      │
  │  AuthGuard (Keycloak JWKS)          │
  │  Tenant resolver middleware         │
  └──┬──────────┬──────────┬────────────┘
     │          │          │
  Postgres   Redis      Temporal
  (RLS)     (BullMQ)   (workflows)
     │
  ┌──▼──────────────────────────────────┐
  │  Integration Adapters               │
  │  Selcom · NMB · CRDB · GePG         │
  │  TRA VFMS · Beem SMS · SES          │
  └─────────────────────────────────────┘
```

**Primary region:** AWS `af-south-1` (Cape Town) — lowest-latency AWS region with PDPA-friendly posture. On-shore TZ DR replica at Raha Cloud / Habari Node (planned).

**AI inference:** vLLM cluster in `af-south-1` behind an in-region AI gateway. Student PII never leaves the region.

### Key architectural rules

1. **Multi-tenancy via Postgres RLS.** Every table has `tenant_id`. RLS policies fire on every query — the app cannot accidentally leak cross-tenant data.
2. **Money in `numeric(18,4)`.** Never floats. `Decimal.js` in TypeScript. Currency is TZS at launch.
3. **Idempotency keys on every payment write.** Duplicate webhook calls are safe.
4. **Audit log is append-only.** Mirrored to S3 Object Lock for PDPA + financial audit.
5. **Domain events via Postgres LISTEN/NOTIFY → Redis stream.** Modules stay decoupled. `PaymentReceived` → Accounting posts journal, Comms sends SMS, Fees marks invoice paid.
6. **AI is human-in-loop by default.** Every AI-generated output carries an "AI-drafted" badge. Parents and staff can request non-AI versions.

---

## 5. Module Reference

### 17 bounded contexts, each a NestJS module

| # | Module | Key responsibilities | Primary roles |
|---|---|---|---|
| 1 | **Identity** | Users, MFA (TOTP), sessions, password policy | Owner |
| 2 | **Tenancy** | School onboarding, subscription tier, branding, campus config | Owner |
| 3 | **Admissions** | Application → offer → enrolment pipeline | Headteacher, HR |
| 4 | **Students** | Registry, guardians, custody rules, medical, photo | HR, Class Teacher |
| 5 | **Academic** | Classes, streams, subjects, enrolment, timetable | Headteacher |
| 6 | **Attendance** | Web mark (teacher), offline mobile mark, reports | Class Teacher |
| 7 | **Exams** | Score entry, report card PDF, grades, positions | Teacher |
| 8 | **Fees** | Fee structures, invoices, control numbers, arrears | Bursar |
| 9 | **Payments** | M-Pesa/bank/GePG/cash collection, webhooks, VFMS receipts | Bursar, Parent |
| 10 | **Accounting** | Double-entry GL, trial balance, bank recon, statements, budgets | Accountant |
| 11 | **Payroll** | PAYE/NSSF/WCF/SDL/HESLB/NHIF, payslips, bulk disbursement | HR, Accountant |
| 12 | **Comms** | SMS (Beem), email (SES), templates, consent ledger | All (system-triggered) |
| 13 | **Boarding** | Dorms, beds, assignments, leave-out, visitors, sick bay | Matron/Patron |
| 14 | **Transport & Meals** | Routes, manifests, canteen wallets, meal recording | HR, Bursar |
| 15 | **Reporting** | NECTA export, BEMIS feed, inspector export, at-risk report, timetable | Headteacher, Auditor |
| 16 | **Health** | API health endpoint | Internal |
| 17 | **AI** *(cross-cutting)* | Gateway, PII scrubber, cost ledger, feature toggles | System |

---

## 6. Data Model Primer

The schema has ~50 tables. These are the ones you'll query most:

```
tenant          → one row per school
campus          → one or more per tenant
user            → all logins (staff + parents + students)
role / user_role → RBAC
student         → the central registry record
guardian        → linked to student via student_guardian
enrollment      → student ↔ class ↔ term
attendance_session / attendance_record
exam / exam_score / report_card

fee_structure   → template of fee line items per class/term
invoice         → generated per student per term from fee_structure
payment         → every payment against an invoice (idempotency_key unique)
reconciliation_run / reconciliation_item

account         → chart of accounts
accounting_period
journal_entry / journal_line   → immutable double-entry
bank_statement / bank_statement_line
budget / budget_line

statutory_rate  → ALL payroll rates versioned by effective_from (never hardcoded)
payroll_run     → one per tenant per YYYY-MM
payslip         → one per staff member per payroll_run

dorm / bed / dorm_assignment
leave_out / visitor / sickbay_visit
route / pickup_point / route_assignment
canteen_wallet / canteen_transaction
timetable_slot

ai_feature / ai_request / ai_generation / ai_cost_ledger / ai_consent
audit_log       → append-only, mirrors to S3
consent         → PDPA channel opt-in per subject
```

**Money columns** are always `numeric(18,4)` with values stored as decimal strings in API responses. Never use JavaScript `number` arithmetic on money — always `Decimal.js`.

---

## 7. Multi-Tenancy & Security

### How tenant isolation works

1. Every row in every table has `tenant_id`.
2. Postgres RLS policies (`RESTRICTIVE TO lumora_app`) enforce: `tenant_id = current_setting('app.current_tenant_id')::uuid`.
3. The NestJS `TenantResolverMiddleware` reads the `tenant_id` claim from the Keycloak JWT and sets the Postgres session GUC before any query runs.
4. The app also asserts `tenant_id` at the service layer (defense in depth).

**Result:** a bug in application code cannot leak data across tenants. The DB will reject the query.

### Authentication

- **Keycloak 24** self-hosted in-region — PDPA-friendly.
- **MFA (TOTP) mandatory** for Owner, Headteacher, Bursar, Accountant roles.
- **SSO** optional for staff (Google Workspace / Microsoft 365) — configure per tenant in Keycloak.
- JWT verified via Keycloak JWKS endpoint (`/.well-known/openid-configuration`).

### RBAC + ABAC

- Role library seeded at tenant creation: Owner, Headteacher, Bursar, Accountant, HR, Teacher, Class Teacher, Matron/Patron, Parent, Student, Nurse, Driver, Auditor.
- ABAC scope guards narrow access further:
  - Class Teacher → only their enrolled class's students
  - Parent → only their own children
  - Matron/Patron → only their assigned dorm

---

## 8. Payment Rails

Soma is a **payment orchestrator**, not a payment service provider. All money flows directly to the school's bank account (or the GoT account via GePG). This keeps Soma out of BoT PSP licensing.

### Adapters

| Channel | Provider | Status | Notes |
|---|---|---|---|
| Mobile money | **Selcom** (Mpesa + Tigo + Airtel + Halotel) | Stub — real API wired on commercial onboarding | Primary aggregator |
| Bank | **NMB**, **CRDB** | Stub — real API per bank | Per-bank commercial contract required |
| Government | **GePG** (Ministry of Finance) | Stub — awaiting SP code | Mandatory for public primary GoT fees |
| Cash | Internal dual-control | Live | Bursar records + second role confirms |
| Fiscal receipt | **TRA VFMS** (VFD) | Stub — awaiting TRA credentials | Required for VRN-holding private schools |

### Control numbers

Private-school invoices use Luhn-validated 12-digit control numbers generated locally (tenant prefix + sequential counter). Public primary fees that flow through GePG use control numbers issued by the Ministry of Finance.

### Reconciliation

A **Temporal nightly workflow** runs at 02:00 EAT:
1. Pulls settlement files from Selcom, GePG, bank adapters.
2. Matches by control number → amount (±TZS 1 tolerance).
3. Auto-posts matched payments; quarantines ambiguous entries.
4. Sends a break-report SMS/email to the bursar if unmatched items remain.
5. A3 AI assist suggests matches for ambiguous entries — bursar confirms each one.

---

## 9. Accounting & Payroll

### Accounting

Full double-entry general ledger. Key rules:
- **Journals are immutable once posted.** Corrections via reversing entries only.
- **Period close requires DR = CR balance** across all posted entries — the system enforces this before allowing close.
- Default chart of accounts is seeded on tenant onboarding (35 accounts, TZ education-friendly structure aligned to MoEST reporting).
- Bank reconciliation: import CSV/MT940 → auto-match by amount ± date window → manual clear for residuals.

### Payroll — Statutory deductions

**Every rate is in the `statutory_rate` table, versioned by `effective_from`. Nothing is hardcoded.**

When the Finance Act changes rates (annually), insert a new row — all payroll runs from that date forward use the new rate automatically.

| Deduction | Who pays | Current basis |
|---|---|---|
| PAYE | Employee | Progressive brackets, monthly gross (Finance Act 2024) |
| NSSF | Both | 10% employee + 10% employer on gross |
| PSSSF | Both | 5% employee + 15% employer (public sector / TSC-posted teachers use this instead of NSSF) |
| WCF | Employer only | 0.6% of gross |
| SDL | Employer only | 3.5% of gross (only if ≥ 10 employees) |
| HESLB | Employee only | 15% of basic (loan-holders only) |
| NHIF/UHI | Both | Schema present, zeroed — activate when MoH mandates |

**Important:** TSC-seconded teachers (public schools) are tracked in Soma's staff records (attendance, leave, contract) but are **not processed through Soma payroll** — they are paid directly by government. The `contract_type = 'tsc_seconded'` flag excludes them from SDL calculations and payroll runs.

When payroll is approved, Soma automatically posts the GL journal: DR Salaries/WCF/SDL; CR Cash/PAYE-payable/NSSF-payable/WCF-payable/SDL-payable/HESLB-payable.

---

## 10. AI Features

All AI features are **opt-in per tenant**, **local-model-first**, and **human-in-loop by default** for anything outbound.

### Feature catalogue

| Code | Feature | Phase | Human-in-loop | Swahili gated |
|---|---|---|---|---|
| A1 | Report-card comment drafts | 2→3 GA | ✅ Teacher approves | Phase 5 |
| A2 | At-risk student early warning | 3 | ✅ Headteacher reviews | No (no LLM) |
| A3 | Payment reconciliation assist | 2 | ✅ Bursar confirms | No |
| A4 | Parent chatbot (WhatsApp + in-app) | 5 | ❌ Auto (escalates) | ✅ |
| A5 | OCR document intake | 1 | ✅ Staff confirms | No |
| A6 | Swahili voice-to-text (teacher app) | 5 | ✅ Teacher confirms | ✅ |
| A7 | Accounting anomaly detection | 3 | ✅ Dual-review | No (no LLM) |
| A8 | Auto-drafted announcements | 2 | ✅ Headteacher sends | Phase 5 |
| A9 | Timetable CP-SAT solver | 5 | ✅ Academic head accepts | No |
| A10 | Interview summariser | 5 | ✅ Interviewer edits | ✅ |
| A11 | Homework hint explainer | 5 gated | ❌ Direct to parent | ✅ |

### Model stack (in-region only)

| Tier | Model | Purpose |
|---|---|---|
| Large | Llama 3.3 70B (AWQ/INT4) via vLLM | Comments, chatbot, announcements |
| Small | Llama 3.2 3B / Gemma 3 4B | Guardrails, PII scrubbing, classification |
| Embeddings | bge-m3 (multilingual) + pgvector | RAG over school knowledge base |
| Speech | Whisper large-v3 + Swahili fine-tune | Voice-to-text for teachers |
| Solver | OR-Tools CP-SAT | Timetable optimisation |

### PII protection

Every prompt passes through the PII scrubber before leaving the API process. Names, NIDA numbers, phone numbers, and admission numbers are replaced with stable placeholders (`<STUDENT_1>`, `<PHONE_1>`). The output is re-hydrated server-side. The scrubbed prompt hash (not the body) is stored in `ai_request`.

### Swahili quality gate

No Swahili-facing feature ships without:
1. Bilingual eval suite passing ≥ 85% pass rate (see `packages/ai-evals`)
2. Native Swahili linguistic reviewer sign-off
3. Product manager approval

---

## 11. Mobile Apps

### Parent app (`apps/mobile-parent`)

- **Android-first.** iOS in v2.
- **Offline-first** via WatermelonDB. Parent can see fees, grades, and timetable with no connection.
- Sync model: server-authoritative timestamps. Server wins on conflict (money and grades are never overwritten by client).
- Login: phone OTP via Keycloak.
- Key screens: My Children → Fees & Pay (M-Pesa/bank) → Grades/Report → Attendance → Messages.

### Teacher app (`apps/mobile-teacher`)

- **Offline attendance** is stored in MMKV with a pending queue. Flushes to API on reconnect.
- Conflict handling: if a session was closed server-side before the teacher's offline marks sync, conflicts are surfaced for review — not silently discarded.
- A6 voice-to-text: tap-to-record → Whisper transcribes → teacher confirms → marks applied.

---

## 12. Compliance & Regulatory

| Authority | Obligation | Where in Soma |
|---|---|---|
| **PDPC** (Personal Data Protection Commission) | Register as controller, consent, DSR, breach notification ≤72h | Consent ledger, DSR self-service, data map, DPIA per AI feature |
| **TRA** | VFD fiscal receipts via VFMS, PAYE/SDL monthly returns | Payments (VFMS adapter), Payroll (PAYE return endpoint) |
| **MoF** | GePG onboarding, SP code, control-number issuance for GoT fees | Payments (GePG adapter) |
| **MoEST / TAMISEMI** | BEMIS reporting, inspection reports | Reporting module |
| **NECTA** | PSLE candidate registration (Std VII) | Reporting module (NECTA CSV export) |
| **NSSF / PSSSF / WCF / HESLB** | Monthly contribution files | Payroll module |
| **TCRA** | Beem sender ID approval (SMS) | Must be completed before going live |
| **BoT** *(indirect)* | All money flows via licensed PSPs only — Soma is not a PSP | Payments adapters only |

### Non-negotiables before go-live

These have multi-week lead times. Start them immediately:

- [ ] PDPC registration filed
- [ ] DPO designated (in-house or retained)
- [ ] GePG onboarding application opened with MoF
- [ ] Beem / NextSMS sender ID applied for with TCRA
- [ ] Selcom or Azampay commercial onboarding started
- [ ] TRA VFMS credentials obtained

---

## 13. Environments & Config

### Environment variables (key ones)

| Variable | What it controls |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `KEYCLOAK_URL` | Keycloak base URL |
| `KEYCLOAK_CLIENT_SECRET` | API client secret from Keycloak admin |
| `JWT_ISSUER` | Must match exactly: `http(s)://<keycloak>/realms/lumora` |
| `SELCOM_API_KEY` / `SELCOM_API_SECRET` | Mobile money adapter (leave blank = stub mode) |
| `GEPG_SP_CODE` | GePG service provider code (leave blank = stub mode) |
| `VFMS_SERIAL_NO` | TRA VFD serial number (leave blank = stub mode) |
| `TEMPORAL_ADDRESS` | Temporal gRPC address |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry collector endpoint |

**Stub mode:** every payment adapter checks for its credentials at startup. If they're missing (or `NODE_ENV=test`), it returns a realistic stub response without making external calls. This means the full system works locally without any real payment credentials.

### Production checklist (before first real school)

- [ ] Postgres in `af-south-1` with RLS and WAL archiving to S3
- [ ] Keycloak on a separate instance (not dev-file DB)
- [ ] All secrets in HashiCorp Vault (not `.env`)
- [ ] S3 buckets: assets + audit (audit bucket uses Object Lock)
- [ ] Temporal namespace with persistence
- [ ] SSL/TLS everywhere (TLS 1.3)
- [ ] Grafana Cloud connected for OTel
- [ ] GitHub Actions runners have no access to production credentials
- [ ] OWASP ASVS L2 scan before first pilot

---

## 14. Codebase Map

```
lumora/
  apps/
    api/                     NestJS main API (port 3000)
    admin-web/               Next.js admin/bursar UI (port 3001)
    parent-web/              Next.js parent portal (port 3002)
    mobile-parent/           React Native parent app (Android-first)
    mobile-teacher/          React Native teacher app
    workers/                 Temporal workers (nightly reconciliation)
  packages/
    domain-ai/               AI gateway types, PII scrubber, all 11 AI features
    ai-evals/                Bilingual eval framework + golden set runner
    ai-gateway/              (scaffold) vLLM HTTP client, semantic cache, guardrails
    shared-auth/             Keycloak JWT helpers, roles enum, hasAnyRole()
    shared-tenancy/          RLS helpers, TenantStorage, withTenantTx()
    shared-i18n/             en-TZ + sw-TZ catalogs, t() resolver
    shared-ui/               (scaffold) Design system, shadcn/ui base
    domain-*/                Domain package placeholders (logic lives in API modules for now)
  services/
    inference-vllm/          (scaffold) vLLM deployment config
    inference-whisper/       (scaffold) Whisper HTTP service
    inference-ocr/           (scaffold) PaddleOCR + timetable solver
  infra/
    terraform/               AWS IaC (VPC, RDS, ECS, S3, KMS)
    helm/                    Kubernetes Helm charts
    docker/                  postgres-init.sql, otel-collector.yml, grafana provisioning
    keycloak/                realm-lumora.json (realm import)
  docs/
    adr/                     Architecture Decision Records
    dpia/                    Data Protection Impact Assessments (one per AI feature)
    runbooks/                Operational runbooks
    KNOWLEDGE_BASE.md        ← you are here
```

---

## 15. Key Decisions Log

| Decision | Rationale |
|---|---|
| NestJS + TypeScript | Large TZ/Kenya talent pool; strong typing; same language as frontend/mobile |
| Postgres RLS for multi-tenancy | Battle-tested; avoids per-tenant schema ops at early scale; reconsider for large tenants in v2 |
| `numeric(18,4)` for money | Float arithmetic errors are unacceptable in financial software |
| Keycloak self-hosted | PDPA-friendly; SAML/OIDC for enterprise tenants; avoids Auth0/Cognito data residency issues |
| Local-model-first AI | PDPA 2022: student PII must not leave the region. Closed-model APIs (OpenAI, Anthropic) are off by default |
| Idempotency keys on payments | Telco/bank webhooks can arrive multiple times. Idempotency at DB level prevents double-posting |
| Versioned statutory rates table | Payroll rates change annually with the Finance Act. Hardcoding them = a compliance incident waiting to happen |
| Temporal for reconciliation | Reconciliation is a long-running, multi-step workflow. Temporal gives retries, visibility, and durability |
| Android-first mobile | ~90% of Tanzanian smartphone users are on Android. iOS shipped in v2 |

---

## 16. Roadmap Status

| Phase | Scope | Status |
|---|---|---|
| 0 — Foundations | Auth, tenancy, RLS, observability, SMS adapter, design system | ✅ Complete |
| 1 — Admissions & Academic | Students, classes, attendance, exams, report cards, parent portal | ✅ Complete |
| 2 — Fees & Payments | Fee structures, invoices, M-Pesa/bank/GePG/cash, reconciliation, TRA receipts | ✅ Complete |
| 3 — Accounting & Payroll | Double-entry GL, payroll with statutory deductions, PAYE returns | ✅ Complete |
| 4 — Boarding, Transport, Meals | Dorms, leave-out, sick bay, routes, canteen wallets | ✅ Complete |
| 5 — Mobile, NECTA, BEMIS, Swahili | Mobile apps, NECTA export, BEMIS feed, i18n, 5 AI features | ✅ Complete |

**v2 backlog (year 2+):** Secondary O/A-level, library, inventory, alumni CRM, iOS, multi-currency, WhatsApp Business API wiring, USSD channel, BEMIS direct API push.

---

## 17. Open Questions

These must be answered before the first production school goes live:

1. **Payment aggregator:** Selcom, Azampay, or Clickpesa? Decision drives which adapter gets real credentials first.
2. **Bank integrations for pilot:** NMB and CRDB are coded. Which does the pilot school actually use?
3. **VRN posture:** Does Soma hold the VRN and issue VFD receipts on the school's behalf, or does each school hold its own? This is a TRA + legal question.
4. **DPO:** In-house or outsourced? Required designation under PDPA for a controller at this scale.
5. **GPU class in `af-south-1`:** `g5.12xlarge` vs `g6e.xlarge` for vLLM? Decided by cost-per-1k-tokens benchmark after onboarding first 5 tenants.
6. **On-shore DR:** Raha Cloud or Habari Node? Validate PDPA posture and SLAs before committing.
7. **NECTA API access:** Apply early — manual CSV export covers the interim but the application process for API credentials takes months.
8. **Primary LLM for Swahili:** Llama 3.3 70B vs Aya Expanse 32B vs Qwen 2.5 72B — run the bilingual eval suite on all three before any Swahili feature ships.
9. **Founding domain expert:** A TZ-based ex-bursar or ex-headteacher on the team is strongly recommended for product quality and sales credibility. This person should also own the Swahili linguistic review process.

---

*Document maintained by the engineering and product team. Last updated: 2026-04-24.*
