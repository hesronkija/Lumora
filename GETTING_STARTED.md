# Getting Started — Local Development

> **Working name:** Lumora → see `docs/KNOWLEDGE_BASE.md` for the naming decision.
> Time to first running server: ~15 minutes.

---

## Prerequisites

| Tool | Required version | Check |
|---|---|---|
| Node.js | ≥ 20 | `node --version` |
| pnpm | ≥ 9 | `pnpm --version` |
| Docker Desktop | latest | `docker --version` |

### Install pnpm (if missing)

```bash
npm install -g pnpm@9
```

### Install Docker Desktop (if missing)

Download from **https://docker.com/products/docker-desktop** — pick the Mac (Apple Silicon or Intel) build. Open the app and wait for the whale icon in the menu bar to show **"Docker Desktop is running"** before continuing.

---

## 1. Clone / navigate to the repo

```bash
cd /Users/hesronkija/Desktop/tanzania-school-system/lumora
```

---

## 2. Create your `.env`

```bash
cp .env.example .env
```

The defaults work for local dev. The `REPLACE_ME` values (AWS, Beem SMS, Vault) are for production integrations — skip them for now.

---

## 3. Install dependencies

```bash
pnpm install
```

This installs all workspaces (API, admin-web, packages) in one pass.

---

## 4. Start infrastructure

```bash
pnpm docker:up
```

Starts: **Postgres 16, Redis 7, Keycloak 24, Temporal, Mailhog, Grafana**.

Wait ~60 seconds for Keycloak to finish importing the realm:

```bash
docker compose logs -f keycloak
# Wait for: "Keycloak 24.x started in"
# Then Ctrl-C
```

---

## 5. Grab the Keycloak client secret

> Do this once — Keycloak generates a new secret on first boot.

1. Open **http://localhost:8080** → log in with `admin` / `admin`
2. Top-left dropdown → switch to the **`lumora`** realm
3. Left nav → **Clients** → `lumora-api` → **Credentials** tab
4. Copy the **Client Secret**
5. Paste it into `.env`:

```
KEYCLOAK_CLIENT_SECRET=<paste here>
```

---

## 6. Run migrations

```bash
pnpm db:migrate
```

Runs all 15 migrations (tenancy → accounting → AI tables). Takes ~5 seconds.

---

## 7. Seed demo data

```bash
pnpm db:seed
```

Creates:
- **Tenant:** Green Valley Primary School
- **Admin user:** `admin@greenvalley.example.com`
- Roles, demo consent record

---

## 8. Create a Keycloak login for the admin user

The seed creates the DB record; you need a matching Keycloak user to log in:

1. **http://localhost:8080** → `lumora` realm → **Users** → **Add user**
2. Username: `admin@greenvalley.example.com` · Email verified: **on** → **Create**
3. **Credentials** tab → Set password `Admin1234!` → Temporary: **off** → **Save**
4. **Role Mappings** tab → Assign `owner`

---

## 9. Start the API

```bash
pnpm --filter @lumora/api dev
```

API starts on **http://localhost:3000**. Swagger UI at **http://localhost:3000/api/docs**.

---

## 10. Start the admin web

Open a second terminal:

```bash
pnpm --filter @lumora/admin-web dev
```

Admin web at **http://localhost:3001**. Login redirects to Keycloak.

---

## Service URLs

| URL | What |
|---|---|
| http://localhost:3000/api/docs | Swagger — all 17 module endpoints |
| http://localhost:3000/api/v1/health | API health check |
| http://localhost:3001 | Admin web |
| http://localhost:3002 | Parent web portal |
| http://localhost:8080 | Keycloak admin |
| http://localhost:8025 | Mailhog (catches all dev emails) |
| http://localhost:8088 | Temporal UI (workflow runs) |
| http://localhost:3100 | Grafana (OTel traces) |

---

## Useful commands

```bash
# Stop everything
pnpm docker:down

# Re-run migrations after adding a new one
pnpm db:migrate

# Roll back the last migration
pnpm --filter @lumora/api migrate:rollback

# Run all tests
pnpm test

# Type-check all packages
pnpm typecheck

# Lint all packages
pnpm lint
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `pnpm install` fails on native deps | `pnpm install --ignore-scripts` then `pnpm rebuild` |
| Migrations fail "relation does not exist" | Postgres not ready — wait 10s and retry |
| Keycloak login redirect fails | Check `KEYCLOAK_CLIENT_SECRET` in `.env` matches Keycloak |
| JWT guard rejects all requests | Confirm `JWT_ISSUER=http://localhost:8080/realms/lumora` in `.env` |
| Port 5432 already in use | Stop local Postgres: `brew services stop postgresql` |
| Keycloak health check fails forever | Docker doesn't have enough RAM — give Docker Desktop at least 4 GB in Settings → Resources |
