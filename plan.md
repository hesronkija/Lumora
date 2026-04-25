# Tanzania School Management System — Target Architecture & Phased Roadmap

> Working name: **Lumora** (placeholder). Replace once branding is chosen.

---

## 1. Context

**Why this exists.** Tanzanian schools — especially public primary (TAMISEMI) and private/international — operate on a patchwork of paper ledgers, Excel fee books, WhatsApp parent groups, and disconnected payment channels. No local product ties admissions, academics, HR, payroll, accounting, parent communication, and multi-rail payment collection into one compliant, multi-tenant system.

**Intended outcome.** A cloud SaaS that a bursar in Arusha, a head teacher in Mbeya, or an admin at an international school in Dar can adopt and use end-to-end: register a student → take fees via M-Pesa/bank/GePG → issue a TRA-compliant receipt → post to the ledger → run payroll at month-end → send results to parents over SMS and app.

**Non-negotiables (from requirements gathering).**
- Target segments: **Public primary (TAMISEMI)** and **Private/International** schools. (Secondary O/A-level deferred.)
- Banking scope: **fee collection, payroll, full double-entry accounting**.
- Payment rails: **mobile money, bank push/pull, GePG, cash** — all required at launch.
- Deployment: **cloud SaaS, multi-tenant**.
- Data compliance: **full PDPA 2022 + Tanzania data residency**.
- Boarding: **dorms, leave-out, visitors, health, transport, meals**.
- Parent channels: **SMS, WhatsApp Business, Android-first mobile app**.
- Language: **English first, Swahili as phase-5 localization**.
- Plan form: **full target architecture + phased roadmap**.

---

## 2. Product Scope (Domain Map)

Seventeen bounded contexts. Each maps to a module with its own schema, service boundary, and permissions matrix.

| # | Context | Core Responsibilities |
|---|---|---|
| 1 | **Identity & Access** | Users, roles, RBAC + ABAC, MFA, session, audit log |
| 2 | **Tenancy** | School onboarding, subscription, branding, configuration |
| 3 | **Admissions** | Application, entrance exam, offer, enrollment |
| 4 | **Student Registry** | Admission number, demographics, guardians, custody, medical, photo |
| 5 | **Staff / HR** | Staff records, contracts, qualifications, TSC number, leave, appraisal |
| 6 | **Academic** | Classes, streams, subjects, curriculum, timetable |
| 7 | **Attendance** | Student + staff attendance (web + mobile), biometric optional |
| 8 | **Exams & Grading** | CATs, terminal, mocks, report cards, positions, NECTA candidate numbers |
| 9 | **Fees & Billing** | Fee structures, invoices, discounts/scholarships, arrears |
| 10 | **Payments** | Mobile money, bank, GePG, cash; reconciliation; TRA EFD/VFD |
| 11 | **Accounting** | Chart of accounts, journal, GL, AR/AP, bank recon, budgets, statements |
| 12 | **Payroll** | PAYE, NSSF/PSSSF, WCF, SDL, HESLB, NHIF, payslips, bulk disbursement |
| 13 | **Communications** | SMS (Beem/NextSMS), WhatsApp Business, email, push, templates |
| 14 | **Parent Portal + App** | Children, fees, attendance, grades, pay, messages |
| 15 | **Boarding** | Dorm assignment, leave-out, visitors, sick bay |
| 16 | **Transport & Meals** | Bus routes, pickup points, canteen/meal wallet |
| 17 | **Reporting & Compliance** | MoEST/TAMISEMI BEMIS feeds, PDPA DSR tooling, inspector exports, analytics |
| 18 | **AI & Intelligence** (cross-cutting) | Local-LLM gateway, PII scrubbing, RAG, guardrails, per-tenant feature toggles, cost ledger — see §5.7 |

---

## 3. Recommended Tech Stack

Optimized for East African talent availability, TZ data residency, and offline-tolerant mobile.

| Layer | Choice | Reason |
|---|---|---|
| **Backend** | Node.js + TypeScript (NestJS monorepo) | Large TZ/Kenya talent pool; strong typing; same language as frontend/mobile |
| **Database** | PostgreSQL 16 (multi-tenant via RLS) | Battle-tested, row-level security for tenant isolation, strong for financial workloads |
| **Queue / Cache** | Redis + BullMQ; Temporal for long workflows (reconciliation, term close) | Reliable, local operator talent |
| **Search** | Postgres FTS → Meilisearch (phase 3+) | Avoid early ops overhead |
| **Web admin** | Next.js (React) + TanStack Query + shadcn/ui | Fast DX, good accessibility primitives |
| **Parent/Teacher mobile** | React Native (Android-first) + WatermelonDB (offline-first) | Shared TS skills, offline-tolerant ledger |
| **Auth** | Keycloak self-hosted (in-region) | PDPA-friendly, SAML/OIDC for enterprise tenants |
| **API** | REST + OpenAPI (core), GraphQL for reporting | REST is simpler for bank/GePG interop |
| **Object storage** | S3 in `af-south-1` (Cape Town) + optional local DR | PDPA/residency |
| **Observability** | OpenTelemetry → Grafana Cloud (EU region) with PII-scrubbing | Cost-effective, compliant |
| **IaC** | Terraform + Terragrunt | Standard |
| **CI/CD** | GitHub Actions + self-hosted runners (for secrets) | Standard |
| **Primary region** | **AWS `af-south-1` (Cape Town)** | Lowest-latency region with PDPA-friendly posture; complemented by on-shore DR replica at a TZ IaaS (Raha / Habari Node) for regulatory posture |
| **AI inference** | **vLLM** serving open-weights (Llama 3.3 70B large-tier; Llama 3.2 3B / Gemma 3 4B small-tier) on GPU in `af-south-1`; `pgvector` for RAG; bge-m3 embeddings; Whisper large-v3 for speech; OR-Tools CP-SAT for timetable | Local-model-first so student PII never leaves the region (PDPA). See §5.7. |

**Rejected alternatives and why.**
- *Laravel/PHP*: cheap talent but weaker fit for a financial system with complex async workflows (payments, recon, payroll). Acceptable alternative if engineering team is already PHP-heavy.
- *Java/Spring*: best enterprise fit but iteration speed hurts pre-PMF; reconsider once public-tender sales start.
- *Per-tenant schema from day 1*: operationally expensive at <100 tenants; use RLS until a tenant pays for isolation.

---

## 4. High-Level Architecture

```
  ┌──────────────────────────────────────────────────────────────────────┐
  │                            CloudFront / CDN                          │
  └──────────────────────────────────────────────────────────────────────┘
            │                          │                     │
     Next.js Admin             Parent Web Portal       Mobile App (RN)
            │                          │                     │
            ▼                          ▼                     ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │                 API Gateway (Kong / AWS API Gateway)                 │
  │      authn (Keycloak JWT) │ rate-limit │ tenant resolver             │
  └──────────────────────────────────────────────────────────────────────┘
            │
            ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │                  Application Services (NestJS modules)               │
  │  Identity │ Admissions │ Students │ Academic │ Fees │ Payments │     │
  │  Accounting │ Payroll │ HR │ Comms │ Boarding │ Reporting           │
  └──────────────────────────────────────────────────────────────────────┘
       │           │             │              │              │
       ▼           ▼             ▼              ▼              ▼
  ┌────────┐  ┌─────────┐  ┌──────────┐  ┌────────────┐  ┌──────────┐
  │Postgres│  │  Redis  │  │ Temporal │  │ Object S3  │  │ Keycloak │
  │  (RLS) │  │  +Bull  │  │          │  │ af-south-1 │  │          │
  └────────┘  └─────────┘  └──────────┘  └────────────┘  └──────────┘
       │
       ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │            Integration Adapters (Hexagonal / Ports-Adapters)         │
  │ ┌──────────┐ ┌──────────┐ ┌──────┐ ┌───────┐ ┌────────┐ ┌─────────┐ │
  │ │Selcom/   │ │NMB/CRDB/ │ │GePG  │ │TRA    │ │Beem /  │ │WhatsApp │ │
  │ │Azampay/  │ │NBC/Equity│ │(MoF) │ │VFMS   │ │NextSMS │ │Cloud API│ │
  │ │Clickpesa │ │Stanbic   │ │      │ │EFD/VFD│ │        │ │         │ │
  │ └──────────┘ └──────────┘ └──────┘ └───────┘ └────────┘ └─────────┘ │
  └──────────────────────────────────────────────────────────────────────┘
```

**Key architectural rules.**
- **Multi-tenancy**: every row has `tenant_id`; enforced at DB by Postgres RLS policies keyed off a session GUC set by the API gateway. A second-layer check in the app asserts the tenant on every service call (defense in depth).
- **Money never lives in floats**: use `numeric(18,4)` in Postgres and `Decimal.js` in TS. Currency is always TZS at launch; multi-currency deferred.
- **Idempotency everywhere on writes that touch money**: every payment/webhook handler requires an `Idempotency-Key`.
- **Audit log is append-only** and mirrored to an immutable sink (S3 Object Lock) for PDPA + financial audit.
- **No direct DB access from mobile/web** — always through the API gateway.
- **Domain events** published to an internal event bus (Postgres LISTEN/NOTIFY → Redis stream) so modules stay loosely coupled (e.g., `PaymentReceived` → Accounting posts journal, Comms sends SMS receipt, Fees marks invoice paid).

---

## 5. Critical Subsystem Designs

### 5.1 Payments & Reconciliation

The hardest part of the product. Designed as a **gateway-agnostic router with pluggable adapters**.

- **Adapter interface**: `createCharge`, `statusCheck`, `handleWebhook`, `reconcileBatch`.
- **Adapters at launch**:
  - `MobileMoneyAggregatorAdapter` — Selcom + Azampay or Clickpesa (pick one primary at launch, dual-wire if volumes justify).
  - `BankAdapter` — NMB (Direct Banking API), CRDB SimBanking biller, NBC, Equity, Stanbic. Most of these require per-bank onboarding contracts.
  - `GePGAdapter` — control-number issuance, bill reconciliation against MoF callback. Required for public primary fee collection flowing through GoT accounts.
  - `CashAdapter` — bursar-entered, dual-control (recorded + confirmed by second role).
- **Control numbers**: generated per invoice using Luhn-validated 12-digit scheme (or issued by GePG when the fee class is a GoT fee). Stored against invoice; shared with parent via SMS deep link.
- **Reconciliation engine** (Temporal workflow, nightly):
  1. Pull statements: bank CSV/MT940 + aggregator settlement report + GePG reconciliation file.
  2. Match by control number → amount → payer msisdn.
  3. Auto-post matched, quarantine ambiguous into a bursar review queue.
  4. Raise break-report to tenant admin at T+1 day.
- **TRA fiscal receipting**: integrate with **VFMS (Virtual Fiscal Management System)** via TRA's API for VRN-holding schools (most private schools). Each payment that is taxable generates a fiscal receipt; e-receipt PDF stored and delivered by SMS/app. Public schools collecting via GePG typically don't require VFD for those flows, but confirm per-school VRN status.

### 5.2 Accounting & Payroll

**Accounting** is a proper double-entry ledger, not a report-builder on top of fees.

- **Chart of Accounts** seeded with a default TZ education-friendly template (assets/liab/equity/income/expense) aligned to MoEST reporting formats; tenant can customize.
- **Journal entries** are immutable once posted; corrections via reversing entries.
- **Periods**: academic term + calendar month; trial balance must balance at every close.
- **Bank reconciliation**: CSV/MT940 import, rule-based auto-match, manual clear.
- **Budgeting**: per department × term, variance reports for board meetings.
- **Statements**: income statement, balance sheet, cash flow (indirect), statement of changes in fund balances (for non-profits).
- **Audit export**: ZIP of all journals + supporting docs + hash chain for an inspector.

**Payroll** must encode TZ-specific statutory deductions correctly — errors here are a compliance/PR disaster. Rates below change most years (Finance Act, contribution orders); **every rate lives in a versioned `statutory_rate` table keyed by effective date**, not hard-coded.

| Deduction | Current rule (Finance Act 2024/25 posture) | Who |
|---|---|---|
| **PAYE** | Progressive monthly brackets; threshold ~TZS 270,000 then tiered; update every Finance Act | Employee |
| **NSSF** (private sector) or **PSSSF** (public/TSC-posted teachers) | 10% employee + 10% employer, computed on gross | Both |
| **WCF** (Workers Compensation Fund) | Currently 0.6% of gross (private); 0.5% public — rate has changed repeatedly, keep configurable | Employer |
| **SDL** (Skills Development Levy) | Currently 3.5% of gross, for employers with ≥10 employees (educational-institution exemptions possible — verify per school) | Employer |
| **HESLB** loan repayment | 15% of basic for loan-holders (raised from 8% in 2016) | Employee |
| **NHIF / incoming UHI (Universal Health Insurance, Act 2023)** | School-optional today; UHI rollout per MoH timeline will likely make this mandatory — design schema to absorb the change | Both |

- **Pay cycle**: monthly with mid-month advance option; ad-hoc bonuses and allowances supported.
- **Disbursement**: bulk payment file to NMB/CRDB, or mobile-money disbursement (Selcom/Azampay payout APIs) for support staff without bank accounts.
- **Payslip**: PDF in Swahili + English, delivered via email and in-app inbox.
- **Year-end**: ITX / PAYE monthly returns to TRA, NSSF/PSSSF monthly contribution files, WCF & SDL remittance reports. Annual wage certificate per employee.
- **Teacher-specific quirk**: for public primary, TSC-posted teachers are paid directly by government, not by the school. Those staff records are **tracked but not paid** by the system (attendance, contract, leave yes; payslip no). The school-hired non-teaching staff still run through our payroll.

### 5.3 Identity, Tenancy, Permissions

- **Tenant = school**. A school can have **campuses** (branches) beneath it.
- **Role library** (seeded): `Owner`, `Headteacher`, `Bursar`, `Accountant`, `HR`, `Teacher`, `Class Teacher`, `Matron/Patron`, `Parent`, `Student`, `Nurse`, `Driver`, `Auditor` (read-only).
- **RBAC + ABAC**: ABAC resource-scoping for Class Teacher (only their class's students), Parent (only their children), Matron (only their dorm).
- **MFA**: TOTP mandatory for Owner/Headteacher/Bursar/Accountant. SMS OTP available but discouraged (cost + security).
- **SSO**: optional Google Workspace / Microsoft 365 for staff in larger private schools.

### 5.4 Communications

- **Providers**: Beem Africa + NextSMS (dual-wire for failover, TCRA-approved sender IDs); WhatsApp Business Cloud API (Meta) for smartphone parents; FCM for mobile push; SES for email.
- **Template system**: Handlebars templates per `(locale, channel, event)`. Message catalog reviewed legally for consent wording.
- **Consent ledger**: explicit opt-in per channel per parent; unsubscribe honored within 24h (PDPA).
- **Rate budgets** per tenant per day to prevent runaway SMS spend.

### 5.5 Mobile (Parent + Teacher)

- **Parent app**: Android-first, iOS phase-4. Login via phone OTP. Offline read for fees/grades/timetable.
- **Teacher app**: attendance (offline-capable, syncs on reconnect), grade entry, homework distribution, parent messaging.
- **Sync model**: WatermelonDB with server-authoritative timestamps; conflict resolution = server wins for money/grades, merge for messages.

### 5.6 NECTA, TAMISEMI/PO-RALG, BEMIS

- **NECTA**: generate candidate number CSVs for PSLE; import result sheets when released. Full API integration dependent on NECTA access — plan manual-assisted flow initially.
- **BEMIS** (Basic Education Management Information System): export enrollment and staff establishment per the TAMISEMI template. Phase 5 target.
- **Inspector mode**: one-click export of all statutory reports for a date range.

### 5.7 AI & Intelligence Layer (Local-LLM-First)

This layer is **opt-in per tenant** and **local-model-first** so that student PII never leaves the region. Closed-model APIs (OpenAI, Anthropic, Gemini) are only permitted for non-PII, non-student tasks (e.g., drafting a public marketing announcement) and are off by default.

#### 5.7.1 Design principles

- **Data residency absolute**: every inference call touches only infra inside `af-south-1` (or on-shore TZ IaaS). No student record, grade, fee amount, or guardian phone ever reaches a third-party LLM API. PDPA 2022 + MoEST inspector-friendly.
- **Human in the loop by default** for anything that leaves the system (SMS to parent, posted grade, ledger entry). AI drafts; a human role confirms. Logged in the audit trail as `ai_suggested` vs `human_accepted` with diff.
- **PII scrubbing on ingress**: names, NIDA, phone numbers, admission numbers replaced with stable placeholders (`<STUDENT_1>`) before the prompt leaves the API process. Output is re-hydrated server-side.
- **Per-tenant opt-in + per-feature toggles**: a school can enable "report-card comments" but disable "parent chatbot." Enterprise tenants can pin to a private model instance.
- **Graceful degradation**: every AI feature ships with a non-AI fallback (manual entry). If inference is down, the product still works.
- **Transparency**: every AI-generated output carries a visible "AI-drafted" badge and is logged. Parents/staff can request the non-AI version.
- **Cost ceiling per tenant per month**: hard cap to prevent runaway inference bills on a per-student-per-term pricing model.

#### 5.7.2 Model stack

| Tier | Purpose | Model (primary) | Model (fallback) | Hosting |
|---|---|---|---|---|
| **Large** | Report-card comments, announcement drafting, chatbot, anomaly-reasoning | **Llama 3.3 70B Instruct** (quantized AWQ/INT4) | Qwen 2.5 72B Instruct; Gemma 3 27B | vLLM on 1–2× `g6e.xlarge` or `g5.12xlarge` in `af-south-1` |
| **Small** | Structured extraction, classification, PII scrubbing, guardrails | **Llama 3.2 3B** or **Gemma 3 4B** | Qwen 2.5 3B | vLLM on CPU-optimized / smaller GPU |
| **Embeddings** | RAG over school knowledge (syllabus, policies), duplicate detection | **bge-m3** (multilingual, Swahili-capable) | `multilingual-e5-large` | CPU inference, `pgvector` in Postgres |
| **Swahili-specialist (eval-gated)** | Swahili-heavy tasks once validated | **Aya Expanse 32B** (Cohere, open-weights, multilingual incl. Swahili); **InkubaLM** (African-language) as a small-model option | Llama 3.3 70B with few-shot Swahili examples | Same vLLM cluster |
| **Speech (Swahili + English)** | Teacher voice-to-text (attendance, comments) | **Whisper large-v3** with Swahili fine-tune | Local Whisper quantized | CPU / modest GPU |
| **OCR** | Document intake (birth certs, prior transcripts) | **PaddleOCR** + **docTR** for structured docs; **Qwen 2.5 VL 7B** for hard cases | Tesseract | CPU primarily; GPU for VL |
| **Classical ML** | At-risk student scoring, fraud/anomaly on ledger | Gradient boosting (XGBoost/LightGBM), isolation forests | — | CPU, scheduled jobs |
| **Constraint solver** | Timetable optimization | **OR-Tools** CP-SAT | FET | CPU |

Model choices are defaults — revisit quarterly as the open-weights landscape shifts. The architecture below is model-agnostic.

#### 5.7.3 Infrastructure

```
    ┌──────────────────────────────────────────────┐
    │            Application Services              │
    └───────────────────┬──────────────────────────┘
                        │ (OpenAI-compatible API contract)
                        ▼
    ┌──────────────────────────────────────────────┐
    │        AI Gateway  (in-region)               │
    │  ┌────────────────────────────────────────┐  │
    │  │  PII scrubber  →  Prompt builder       │  │
    │  │  Router (feature → model)              │  │
    │  │  Rate-limit + tenant cost cap          │  │
    │  │  Cache (semantic + exact)              │  │
    │  │  Guardrails (input + output filters)   │  │
    │  │  PII re-hydration                      │  │
    │  │  Audit logger                          │  │
    │  └────────────────────────────────────────┘  │
    └───────────────────┬──────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
    ┌─────────┐    ┌─────────┐    ┌──────────┐
    │  vLLM   │    │ Whisper │    │ pgvector │
    │ cluster │    │  OCR    │    │  (RAG)   │
    └─────────┘    └─────────┘    └──────────┘
```

- Serving: **vLLM** with continuous batching + paged attention; Ollama only for dev.
- Gateway exposes an OpenAI-compatible API internally so we can swap models without touching app code.
- Cache layer: exact-match on prompt hash + semantic cache (embedding similarity) for high-repeat queries like parent-chatbot FAQs (big cost lever).
- GPU autoscaling: floor of 1 GPU, scale up for batch jobs (nightly report-card comment drafting).
- Observability: per-request token counts, latency, tenant, feature, safety-flag — piped into standard OTel stack.

#### 5.7.4 Feature catalog

| # | Feature | Where | Phase | Human-in-loop | PII handling |
|---|---|---|---|---|---|
| A1 | **Report-card comment drafts** (per student per subject per term, Swahili + English) | Admin web, exams module | Phase 2 → GA Phase 3 | ✅ Teacher edits and approves before publish | Student name & grades scrubbed; re-hydrated on render |
| A2 | **At-risk student early warning** (attendance + grades + arrears → risk score) | Admin web dashboard | Phase 3 | ✅ Headteacher reviews list; decides action | No PII leaves region; classical ML, no LLM |
| A3 | **Payment reconciliation assist** (fuzzy-match ambiguous telco/bank receipts to students) | Bursar recon queue | Phase 2 | ✅ Bursar confirms each match | Full in-region; names/phones scrubbed when LLM used |
| A4 | **Parent chatbot** (Swahili + English, WhatsApp + in-app) | Comms module | Phase 5 | ❌ Auto-responds to FAQ; escalates ambiguous | RAG restricted to tenant's own data; strict scope guardrails |
| A5 | **Document OCR intake** (birth cert, NIDA, prior transcript) | Admissions | Phase 1 | ✅ Staff confirms extracted fields | Files encrypted in S3; OCR runs in-region |
| A6 | **Swahili voice-to-text** (teacher attendance/grades by phone) | Teacher mobile app | Phase 5 | ✅ Shown as draft; teacher confirms | Audio processed in-region; audio file purged after text extraction unless consented for model improvement |
| A7 | **Accounting anomaly detection** (fraud / unusual journals) | Accounting dashboard | Phase 3 | ✅ Bursar + headteacher dual-review | Classical ML; no external call |
| A8 | **Auto-drafted announcements** (headteacher intent → SMS/WhatsApp copy in both languages) | Comms module | Phase 2 | ✅ Headteacher edits and sends | Only if announcement is non-PII (bulk); single-student messages use templates, not LLM |
| A9 | **Timetable constraint solver** (CP-SAT, not LLM) | Academic module | Phase 5 | ✅ Academic head accepts/tweaks | No PII; deterministic solver |
| A10 | **Admissions-interview summarizer** (record → structured notes) | Admissions | Phase 5 | ✅ Interviewer edits | Audio processed in-region; consent captured from interviewee |
| A11 | **Syllabus-aware homework-hint explainer** (parent app, primary) | Parent app | Phase 5, gated | ❌ Direct to parent/student | Strictly grounded RAG on approved Tanzanian syllabus content; refuses off-topic |

Deliberately **not** shipping:
- AI-generated grades — students are graded by humans only.
- AI-generated payslips / journal entries — money is human-posted.
- Face recognition for student attendance — privacy-sensitive and brittle.
- AI-based admissions decisions — discriminatory-risk and legally fraught.

#### 5.7.5 Safety, evaluation, governance

- **Eval suite** per feature, bilingual (en-TZ + sw-TZ): golden set maintained by Product + TZ domain expert; regression tested on every model upgrade; results tracked in a public-to-tenant dashboard.
- **Swahili quality bar**: native reviewer gates any Swahili-facing feature before GA. A feature ships only when reviewer sign-off is ≥ target quality on the bilingual eval.
- **Content filters**: input + output guardrails via small-model classifiers (toxicity, PII leakage, off-scope jailbreaks). Flagged outputs go to a review queue, not the parent.
- **Red-team cadence**: quarterly internal red-team + annual external; prompt-injection test battery run on every deploy.
- **Data-for-improvement**: model improvement data is strictly opt-in per tenant; when enabled, PII is irreversibly pseudonymized and kept in-region. Default = off.
- **DPIA per AI feature**: PDPA requires a Data Protection Impact Assessment; one DPIA per feature, reviewed by DPO before launch.
- **Right to non-AI**: parent/staff can request any AI-drafted communication be regenerated by a human. Logged.

#### 5.7.6 Swahili strategy

Swahili is under-represented in most open-weights models. Mitigations:
- Benchmark the model stack on a curated sw-TZ eval set (report-card comments, announcements, FAQ answers) before any Swahili feature ships.
- Use **few-shot prompting with curated sw-TZ examples** before investing in fine-tuning.
- Consider **LoRA fine-tuning** of Llama 3.3 70B on a sw-TZ instruction corpus in year 2 if eval gaps persist. Budget: 1–2 researcher-months + ~$3–5k compute.
- Engage a native Swahili linguistic reviewer from Phase 1 — same person who reviews the UI translations.

#### 5.7.7 Data model additions

Append to Section 6:

- `ai_feature(id, tenant_id, feature_code, enabled, config_json)`
- `ai_request(id, tenant_id, feature_code, user_id, model, prompt_hash, tokens_in, tokens_out, latency_ms, safety_flags, at)` — no prompt body stored; hash only
- `ai_generation(id, ai_request_id, output_ref, status=[drafted|human_accepted|human_rejected|edited], diff_json)`
- `ai_cost_ledger(id, tenant_id, period, feature_code, tokens, tzs_cost)`
- `ai_consent(id, tenant_id, subject_ref, scope, status)` — for voice capture, interview recording, etc.

---

## 6. Data Model (Core Entities — Illustrative)

Not exhaustive — this is the shape of the registry so reviewers can sanity-check it.

- `tenant(id, name, kind=[public_primary|private|international], registration_no, vrn, motto, ...)`
- `campus(id, tenant_id, name, address_ward, address_district, address_region, gps)`
- `user(id, tenant_id, email, phone, password_hash, mfa_secret, locale, ...)`
- `role(id, tenant_id, code, name); user_role(user_id, role_id, scope_json)`
- `student(id, tenant_id, admission_no, legal_name, dob, gender, nida, photo_key, ...)`
- `guardian(id, tenant_id, legal_name, phone, relation, nida, custody_rules_json)`
- `student_guardian(student_id, guardian_id, is_primary, can_pickup, fin_responsible)`
- `staff(id, tenant_id, employee_no, tsc_no, legal_name, role_ref, contract_type, ...)`
- `class(id, tenant_id, academic_year, stream, level=[std1..std7|form1..], class_teacher_id)`
- `enrollment(id, student_id, class_id, term, status)`
- `subject(id, tenant_id, code, name, level_range)`
- `fee_structure(id, tenant_id, class_id, term, items_json)`
- `invoice(id, tenant_id, student_id, term, items_json, amount, arrears, control_no)`
- `payment(id, tenant_id, invoice_id, amount, channel, provider_ref, fiscal_receipt_no, status, idempotency_key)`
- `account(id, tenant_id, code, name, type, parent_id)` — chart of accounts
- `journal_entry(id, tenant_id, posted_at, source_module, source_ref, narrative)`
- `journal_line(journal_id, account_id, dr, cr, currency=TZS)`
- `payroll_run(id, tenant_id, period, status); payslip(id, payroll_run_id, staff_id, earnings_json, deductions_json, net)`
- `message(id, tenant_id, recipient_ref, channel, template, status, cost_tzs)`
- `consent(id, tenant_id, subject_ref, channel, status, timestamp, evidence)`
- `audit_log(id, tenant_id, actor_id, action, resource, before, after, ip, at)` — append-only
- Boarding: `dorm`, `bed`, `dorm_assignment`, `leave_out`, `visitor`, `sickbay_visit`
- Transport: `route`, `pickup_point`, `route_assignment`, `bus`, `driver`
- Meals: `meal_plan`, `canteen_wallet`, `canteen_transaction`

All tables carry `tenant_id` (except global lookup tables) and are covered by RLS policies.

---

## 7. Non-Functional Requirements

| Category | Target |
|---|---|
| Availability | 99.5% in Y1, 99.9% in Y2 (peak windows = fee deadlines in Jan/May/Sep) |
| RPO / RTO | 15 minutes / 4 hours |
| Scalability | 2,000 tenants × 1,000 students avg = ~2M students at steady state |
| Latency (p95) | <400ms API in-region; <2s mobile cold-start sync on 3G |
| Security | OWASP ASVS L2, encryption at rest (KMS) and in transit (TLS 1.3), secrets in Vault |
| Privacy | PDPA 2022 compliant: consent, DSR, breach notification ≤72h, DPO designated |
| Accessibility | WCAG 2.1 AA for all parent- and staff-facing UIs |
| Backup | Daily full + continuous WAL; monthly restore drill |
| Observability | OTel traces + structured logs; PII scrubbing pipeline; 30-day retention hot, 1-year cold |
| Localization | en-TZ at launch; sw-TZ by phase 5 |

---

## 8. Compliance & Regulatory Posture

| Authority | Obligation | Where it lands in the product |
|---|---|---|
| **PDPC** (Personal Data Protection Commission) | Register as controller/processor, consent, DSR, breach notification | Consent ledger, DSR self-service, data map |
| **TRA** | Fiscal receipting via VFMS (EFD/VFD), PAYE/SDL returns | Payments module, Payroll module |
| **MoF** | GePG onboarding, SP code, control-number issuance for GoT fees | Payments (GePG adapter) |
| **MoEST / TAMISEMI (PO-RALG)** | BEMIS reporting, inspection reports | Reporting module |
| **NECTA** | PSLE candidate registration (Std VII) | Exams module |
| **NSSF / PSSSF / WCF / HESLB / NHIF** | Monthly contribution files and payments | Payroll module |
| **BoT** (indirectly) | Money flows via licensed PSPs only — we are not a PSP | Payments adapters only |
| **TCRA** | Sender IDs, USSD shortcodes (if added later) | Comms module |
| **Employment & Labour Relations Act** | Leave entitlements, contracts | HR module |

**Important:** we do not hold customer funds. All mobile-money/bank flows settle directly to the school's own account (or the GoT account via GePG). We are an orchestrator and record-keeper. This keeps us out of BoT PSP licensing.

---

## 9. Phased Roadmap (12 months from eng kickoff)

### Phase 0 — Foundations (Month 1–2)
- Repo, CI/CD, IaC, observability, secrets mgmt.
- Postgres RLS tenancy pattern, auth (Keycloak), audit log, RBAC/ABAC.
- Base UI shell (Next.js), design system.
- Comms adapter skeleton (Beem + SES) with consent ledger.
- **Parallel non-engineering work**: PDPC registration filed; DPO designated; GePG onboarding application opened with MoF; Beem/NextSMS sender ID approved by TCRA; aggregator (Selcom or Azampay) commercial onboarding started. These all have multi-week lead times and must not wait for code to be ready.
- **Exit criteria**: a tenant can be provisioned, an admin can log in with MFA, an audit trail is produced, an SMS can be sent with cost recorded.

### Phase 1 — Admissions & Academic (Month 3–4)
- Admissions: online form, docs, application fee, offer.
- Student registry + guardian with custody/pickup rules.
- Classes/streams/subjects; timetable (manual first; solver in phase 5+).
- Attendance (web only at this phase).
- Grades & report cards (PDF).
- Parent portal (read-only web).
- **AI**: stand up AI Gateway skeleton (PII scrubber, audit log, cost ledger, model router — no features live yet). **A5 OCR document intake** at admissions goes live with human-confirm.
- **Exit**: one pilot school can register a term's worth of students and issue report cards.

### Phase 2 — Fees & Payments (Month 4–6)
- Fee structures (class/boarder/day/scholarship).
- Invoice generation + control numbers.
- Aggregator adapter (Selcom or Azampay — pick one at launch).
- Bank adapter (NMB + CRDB minimum).
- Cash receipting with dual control.
- TRA VFMS integration (VRN schools).
- GePG adapter (public primary pilot).
- Reconciliation engine (nightly Temporal workflow).
- **AI**: **A3 payment-reconciliation assist** (LLM suggests matches for the ambiguous queue, bursar confirms). **A8 auto-drafted announcements** (beta, English only). **A1 report-card comment drafting** lands in private beta at the end of phase 2.
- **Exit**: a parent pays M-Pesa → school gets a reconciled receipt in <5 min; bursar closes a day without manual Excel.

### Phase 3 — Accounting & Payroll (Month 6–9)
- Chart of accounts, journal, GL, AR/AP.
- Bank statement import + recon.
- Trial balance, income statement, balance sheet, cash flow.
- Budgets + variance.
- Payroll: PAYE, NSSF/PSSSF, WCF, SDL, HESLB, NHIF.
- Payslip + bulk disbursement.
- Audit export for inspectors.
- **AI**: **A1 report-card comment drafting** to GA (Swahili after Phase 5 linguistic sign-off). **A2 at-risk student early warning** (classical ML). **A7 accounting anomaly detection**.
- **Exit**: pilot school closes a month with full statements; payroll runs statutorily correctly.

### Phase 4 — Boarding, Transport, Meals (Month 9–10)
- Dorm assignment, leave-out, visitor log, sick bay.
- Transport: routes, pickup points, per-route billing, optional GPS.
- Canteen wallet + meal plans.
- **Exit**: private boarding school can onboard end-to-end.

### Phase 5 — Mobile, NECTA, BEMIS, Swahili (Month 10–12)
- Parent mobile app (Android-first, iOS follow-on).
- Teacher mobile app (attendance + grades + messaging, offline-first).
- NECTA PSLE candidate export.
- TAMISEMI BEMIS data feed.
- Full Swahili localization (UI, templates, receipts).
- **AI**: **A4 parent chatbot** (bilingual, WhatsApp + in-app, RAG on tenant data). **A6 Swahili voice-to-text** for teacher app. **A9 timetable CP-SAT solver**. **A10 admissions-interview summarizer**. **A11 syllabus-aware homework hints** (gated pilot). All Swahili-facing features gated on native-reviewer sign-off.
- **Exit**: public primary can be sold without Excel dependency and with Swahili-native UX.

### Continuous
- Security: OWASP ASVS L2, quarterly pentest from phase 2 onwards.
- Pilot programs: 1 public primary + 1 private school running in production by end of phase 2; scale to 10 schools by end of phase 5.
- Localization review by native Swahili linguistic reviewer before phase-5 GA.

### Explicitly deferred to v2 (year 2+)
These are valuable but deliberately out of the 12-month plan to protect focus:
- **Secondary O-level and A-level** (Form 1–6): full subject-combination support, CSEE/ACSEE candidate registration, division-based grading.
- **Library management** (catalog, borrowing, fines).
- **Inventory & procurement** (stock, POs, vendor bids — beyond the AP already in accounting).
- **Student discipline / conduct ledger** (incidents, merits/demerits, parent notification).
- **Alumni tracking** and donor CRM.
- **School calendar / events** with RSVP and parent-teacher meeting scheduling.
- **Teacher CPD** (continuing professional development) log.
- **USSD short-code parent channel** (feature-phone parents).
- **iOS parent app** (Android-only at launch).
- **Multi-currency** (fee collection in USD for international schools).
- **Timetable auto-solver** (constraint-based) — manual timetable at launch.

---

## 10. Go-to-Market Boundary Conditions

Not a technical plan, but these drive priorities:

- **Pricing model**: per-student per-term (e.g., TZS 500–2,000/student/term depending on modules), with floor minimum per school. Free tier for first pilot year at one public primary to build case studies.
- **Onboarding**: dedicated customer-success lead in Dar; data-migration service from Excel/paper for first 20 schools.
- **Partnerships**: preferred-biller status with NMB and CRDB; Selcom/Azampay reseller; MoU with a teacher-training college for product credibility.
- **Sales cycles**:
  - Private schools: headteacher or owner decides; 4–8 weeks.
  - Public primary: ward/district/TAMISEMI coordination; 6–12 months; often tender-driven.

---

## 11. Verification Strategy (How to know it works)

- **Unit + integration tests**: Jest + Testcontainers (Postgres). Target 80% coverage in payment/accounting/payroll; lower elsewhere.
- **Contract tests**: Pact against Selcom/Azampay sandbox, GePG UAT, Beem/NextSMS, VFMS sandbox.
- **End-to-end**: Playwright covering golden paths per module.
- **Load tests**: k6 simulating fee-deadline peaks (10× normal payment rate for 2h).
- **Security**: SAST (Semgrep), dependency scanning (Snyk/OSV), quarterly external pentest from phase 2.
- **Statutory correctness**: payroll test suite with a published matrix of PAYE/NSSF/etc. cases reviewed by a TZ tax accountant.
- **Financial correctness**: double-entry invariant check nightly (`sum(dr) == sum(cr)` per tenant per period).
- **PDPA DSR drills**: quarterly rehearsal of data subject request fulfillment within statutory deadline.
- **Pilot UAT**: one bursar and one headteacher per pilot school sign a UAT checklist per phase.

---

## 12. Key Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| GePG onboarding delayed by MoF | High | Blocks public-primary launch | Start onboarding in Phase 0; public pilot runs on cash+bank until GePG lands |
| Statutory payroll rates change mid-year | High | Incorrect deductions, reputational | Rates in config table, versioned by effective date; annual Finance Act review |
| Mobile money settlement breaks (telco outage) | Medium | Parents blame us, not telco | Dual aggregator, clear user messaging, automatic retry + failover |
| Public schools can't afford SaaS pricing | High | Niche shrinks | TAMISEMI-tier pricing or donor/NGO co-funded rollout; per-district license |
| PDPA enforcement tightens | Medium | Fines, sales block | Register early, DPO on retainer, DPIA documented per module |
| Offline-first mobile complexity balloons | High | Phase-5 slips | Keep sync model server-authoritative; defer iOS; conservative scope |
| Key-person risk on Swahili translation quality | Medium | Public-segment rejection | Native Swahili reviewer contracted from phase-1; glossary owned by Product |
| Scope creep into secondary (O/A-level) before core is stable | High | Dilutes delivery | Written "no secondary until phase-5 GA" commitment; revisit at year 2 |
| Security incident — credentials, exam data, or financial data leak | Medium | Brand-ending | Secrets in Vault; no plaintext PII in logs; per-tenant KMS keys for sensitive fields; quarterly pentest; incident-response runbook rehearsed |
| Incumbent competition (Shule Direct, existing SIS vendors, in-house Excel) | High | Slow sales | Ruthless focus on the one workflow competitors do worst — integrated fees→GL→payslip in one product; local CS team for onboarding |
| AI hallucination in parent-facing output (wrong fee amount, wrong grade narrative) | Medium | Trust-destroying | Human-in-loop on everything outbound; non-PII-aware features only; visible "AI-drafted" badge; right-to-non-AI |
| GPU cost on `af-south-1` breaks unit economics | Medium | Cuts AI features | Per-tenant AI cost cap; aggressive semantic cache; small-model routing; fall back to template-only when cap hit |
| Swahili LLM quality gap | High | Phase-5 Swahili AI features under-deliver | Bilingual eval gate before GA; few-shot prompting before fine-tune; LoRA fine-tune budget reserved for year 2 |
| Prompt injection / data exfiltration via chatbot or document OCR | Medium | PDPA breach | Strict RAG scoping per tenant; small-model guardrails on input + output; red-team cadence; no agentic tool-use from parent-facing chat |

---

## 13. Open Questions to Close Before Implementation

These are not blockers for planning, but must be answered before the first line of production code:

1. **Which payment aggregator first — Selcom, Azampay, or Clickpesa?** Decision driven by onboarding speed, coverage of all four telcos, and commercial terms.
2. **Which bank integrations ship in phase 2 beyond NMB/CRDB?** Depends on pilot school banking.
3. **Will the founding team include a TZ-based domain expert (ex-bursar or ex-headteacher)?** Strongly recommended for product quality.
4. **Hosting counterparty on-shore for DR** — Raha Cloud? Habari Node? (Validate PDPA posture and SLAs.)
5. **Will the product hold the VRN and issue VFD receipts on the school's behalf, or require each school to hold its own VRN?** Legal + TRA question.
6. **DPO — in-house or outsourced?** Required designation under PDPA for a controller at this scale.
7. **Primary large-tier LLM: Llama 3.3 70B vs Qwen 2.5 72B vs Aya Expanse 32B?** Pick after running the bilingual eval suite on all three.
8. **GPU class and reserved capacity in `af-south-1`** — `g5.12xlarge` vs `g6e.xlarge` vs on-shore TZ GPU (if any) — decided by cost-per-1k-tokens and tenant concurrency model.
9. **LoRA fine-tune budget for Swahili** — year-2 decision, but reserve the training data pipeline in phase 5.

---

## 14. Files / Artifacts That Would Exist When This Is Built

This plan predates any code, so there are no existing critical files to modify. When implementation starts, the repo is expected to be a TypeScript monorepo with this rough layout:

```
lumora/
  apps/
    api/                      # NestJS main API
    admin-web/                # Next.js admin/bursar UI
    parent-web/               # Next.js parent portal
    mobile-parent/            # React Native parent app
    mobile-teacher/           # React Native teacher app
    workers/                  # Temporal workers, queue consumers
  packages/
    domain-admissions/
    domain-students/
    domain-academic/
    domain-fees/
    domain-payments/          # adapters live here
    domain-accounting/
    domain-payroll/
    domain-comms/
    domain-boarding/
    domain-transport-meals/
    domain-reporting/
    domain-ai/                # AI gateway, feature registry, cost ledger
    ai-gateway/               # PII scrubber, router, guardrails, cache
    ai-evals/                 # bilingual eval suite + golden sets
    shared-auth/              # Keycloak integration, RBAC/ABAC
    shared-tenancy/           # RLS helpers, tenant resolver
    shared-ui/                # design system
    shared-i18n/              # en-TZ / sw-TZ catalogs
  services/
    inference-vllm/           # vLLM deployment + model configs
    inference-whisper/        # speech-to-text service
    inference-ocr/            # OCR pipeline
  infra/
    terraform/
    helm/
  docs/
    adr/                      # architecture decision records
    runbooks/
    dpia/                     # Data Protection Impact Assessments (one per AI feature)
```

---

## 15. What I Need From You Next

1. **Do you want me to go deeper on any single module** (e.g., a full payments-integration design doc, or a full payroll calculation spec with worked examples), or keep this as the target architecture?
2. **Are you building this as a founder/team, or commissioning it?** That changes whether the next artifact is an engineering backlog or a vendor brief.
3. **Confirm whether the product intends to hold VRN** (affects TRA/VFD architecture).

Once those are clear, the next planning iteration can produce either (a) a Phase-0 engineering backlog with tickets, or (b) a pilot-school onboarding playbook, depending on what unlocks you.
