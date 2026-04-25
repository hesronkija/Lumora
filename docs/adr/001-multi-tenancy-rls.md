# ADR-001: Multi-tenancy via Postgres Row Level Security

**Status:** Accepted
**Date:** 2026-04-23
**Deciders:** Engineering lead

## Context

We need tenant isolation with zero risk of data leakage between schools. Options:
1. Separate database per tenant — expensive ops at <100 tenants
2. Separate schema per tenant — migration complexity, schema proliferation
3. Shared schema with `tenant_id` + RLS — standard SaaS pattern

## Decision

Shared schema with `tenant_id` on every table, enforced by Postgres RLS policies keyed off a session GUC (`app.current_tenant_id`). The API sets this GUC at the start of every request via the tenant resolver middleware. A second in-app assertion (service layer checks `TenantStorage`) provides defense in depth.

## Consequences

- Migrations run once, not per tenant
- RLS policy bugs could theoretically expose data — mitigated by always using the `lumora_app` role (never superuser) in production requests
- Performance: RLS adds a small predicate on every query — acceptable for this scale
- Transition to per-tenant schema: straightforward if a large enterprise tenant ever pays for isolation
