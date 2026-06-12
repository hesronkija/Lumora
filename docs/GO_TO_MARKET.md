# Lumora — Go-To-Market Guide

Everything you need to understand, demo, price and sell the system.

## 1. Reading order (chronological)

1. **README.md** — what the product is, 60-second demo, repo map.
2. **docs/GO_TO_MARKET.md** (this file) — roles, monetization, pricing, distribution.
3. **docs/OPERATIONS.md** — how to run it, the security model, statutory rates, payment-provider onboarding. Read before any customer conversation about data safety.
4. **docs/adr/** — architecture decisions (why RLS, why Selcom/GePG, why local-first AI).
5. **docs/dpia/** — PDPA 2022 data-protection assessment; schools and regulators will ask.
6. **docs/runbooks/** — incident/ops procedures, useful when you promise an SLA.
7. **apps/api/src/database/migrations/** — skim in order 001→017; it is the truest description of what the system stores.

## 2. Users & roles — who creates whom

Yes — accounts are created top-down inside each school (tenant):

```
You (platform) ──provision──► School tenant + first Owner account
Owner ──creates──► Headteacher, Bursar, Accountant, HR
HR/Headteacher ──create──► Teachers, Class Teachers, Matron, Nurse, Driver
System ──auto-invites──► Parents (SMS link when a guardian is attached to a student)
```

Role library (all seeded per tenant, see `/users` page in the app):

| Role | Kiswahili | Access | MFA |
|---|---|---|---|
| Owner / Director | Mmiliki | everything incl. settings & billing | ✔ |
| Headteacher | Mwalimu Mkuu | academics, approvals, reports, AI drafts | ✔ |
| Bursar | Mhasibu wa Ada | fees, payments, cash dual-control | ✔ |
| Accountant | Mhasibu | ledger, journals, budgets | ✔ |
| HR Officer | Afisa Utumishi | staff records, payroll input | |
| Teacher / Class Teacher | Mwalimu (wa Darasa) | own classes: attendance, scores | |
| Matron/Patron | Mlezi wa Bweni | dorms, leave-outs, visitors | |
| School Nurse | Muuguzi | sick bay, confidential medical notes | |
| Driver | Dereva | own route manifest | |
| Parent/Guardian | Mzazi/Mlezi | own children only | |
| Student | Mwanafunzi | own timetable/results (secondary phase) | |
| External Auditor | Mkaguzi | read-only finance, time-boxed | |

Scope rules (ABAC) keep a class teacher inside their own class and a parent
inside their own children — enforced in API guards *and* by RLS at the DB.

## 3. Monetization — step by step

1. **Entity & rails.** Register a company (BRELA), get a TIN, open a collection
   account. Sign the Selcom merchant agreement (one agreement covers M-Pesa,
   Tigo Pesa, Airtel Money) and a bank biller contract (NMB or CRDB first).
2. **Billing model.** Charge each school **per student per term** (the model
   Tanzanian schools already understand from ShuleSoft). Lumora records
   per-tenant usage; invoice schools termly via the same payment rails the
   product uses.
3. **Collect.** School pays your control number via mobile money/bank — your
   own product proves the rails work. Issue TRA receipts for your fees.
4. **SMS pass-through.** SMS costs (~TZS 25/message via Beem) are metered per
   tenant in the `message` table — bill them at cost + margin, or bundle a
   monthly quota per plan.
5. **Upsell ladder.** Boarding/transport modules, AI features (LLM tier),
   parent app branding, and integration onboarding (GePG for public schools)
   are natural premium tiers.
6. **Pilot motion.** Give 1–3 schools a free term in exchange for being
   reference customers; convert at the start of the next term — schools buy
   at term boundaries (Jan, May, Sep).

## 4. How a school "gets" the product (distribution)

It's cloud SaaS — nothing to install:

1. You deploy once (see OPERATIONS.md): API + Postgres + Keycloak behind
   `*.lumora.app` (or your domain), af-south-1 region for PDPA residency.
2. You provision a tenant: `POST /tenancy` → school gets
   `greenvalley.lumora.app` + the first Owner login.
3. Staff sign in from any browser; the app is a **PWA** — one click installs
   a desktop/Android icon. Parents/teachers get the Android apps from the
   Play Store (build `apps/mobile-*` when ready).
4. Updates ship centrally; no per-school IT visits. Offline-first mobile
   covers schools with weak connectivity.

## 5. Pricing (Tanzania market context, June 2026)

Market anchors: budget products like MSSIS list **TZS 30,000/school/year**
and local vendors advertise from TZS 30,000 — these compete on price with
no payments/payroll/AI. The market leader (ShuleSoft, 500+ schools) prices
per student on inquiry and wins on bank/mobile-money integration — the same
ground Lumora stands on, plus payroll, full double-entry, Swahili UI and AI.

Suggested list pricing (per student **per term**, billed to the school):

| Plan | TZS/student/term | Includes |
|---|---|---|
| **Msingi** (Core) | **1,500** | registry, attendance, exams & report cards, fees + mobile-money/bank collection, parent SMS (pay-per-SMS) |
| **Shule+** (Standard) | **2,500** | + accounting, payroll, HR, WhatsApp, parent app, AI report comments & early-warning |
| **Taasisi** (Premium) | **4,000** | + boarding, transport & meal wallets, GePG (public), LLM-tier AI, priority support, auditor access |

Floor: **TZS 150,000/school/term** minimum so tiny schools still cover your
infra. A 400-student school on Shule+ ≈ TZS 1,000,000/term (≈ 3M/year ≈
~USD 1,200) — affordable next to one clerk's monthly salary, and the fee
collection improvement typically pays for it. International schools: price
in USD (e.g. $2–3/student/term) with annual billing.

Rules of thumb: never discount the price — extend the pilot instead; bill
termly in advance; SMS at cost+20%; charge GePG onboarding as a one-time
integration fee (e.g. TZS 500,000) since it consumes your staff time.

## 6. Before the first sale — checklist

- [ ] Deploy production stack (OPERATIONS.md §7) with backups + monitoring
- [ ] Selcom + one bank contract signed (stub mode off)
- [ ] Beem SMS account funded
- [ ] PDPA registration as data processor; DPIA reviewed (docs/dpia)
- [ ] Demo tenant seeded (the built-in Green Valley demo sells well)
- [ ] Pricing one-pager in Swahili + English
- [ ] Onboarding playbook: import students from Excel, train bursar (half-day)
