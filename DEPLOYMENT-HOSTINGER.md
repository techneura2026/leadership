# DEPLOYMENT-HOSTINGER.md — LeaderPrism Dev on the Hostinger VPS

The **development** environment runs on the shared Hostinger VPS that also hosts
BizOS, LMS and others. It moved there from the Azure dev VM (`leaderprism-vm-dev`)
on 2026-10-02, when the "Leadership" Azure subscription went into the *Warned*
(read-only, about to be disabled) state. The landing site moved with it, off
Azure Static Web Apps.

Server-wide conventions (shared Caddy, the `edge` network, SSH access, known
gotchas) live on the VPS itself in `/opt/README.md`. Read that before changing
anything outside `/opt/leaderprism/`.

## At a glance

| | |
| :--- | :--- |
| App (web + API) | https://leaderprism.187-127-182-104.sslip.io |
| API base | https://leaderprism.187-127-182-104.sslip.io/api/v1 |
| Landing | https://leaderprism-landing.187-127-182-104.sslip.io |
| VPS | `187.127.182.104`, SSH as `bizosadmin` (key-only; get the key from the team vault) |
| Directory | `/opt/leaderprism/` — `docker-compose.yml`, `init.sql`, `.env` |
| Deployed by | `.github/workflows/deploy-dev.yml` on every push to `master` |
| Images | `ghcr.io/techneura2026/leadership/{api,web,landing}:dev-latest` (plus `sha-<short>`) |

The compose project (`deploy/hostinger/docker-compose.yml`, copied to
`/opt/leaderprism/` by CI) runs these containers:

| Service | What | Notes |
| :--- | :--- | :--- |
| `postgres` | Postgres 16 | Volume `leaderprism_pgdata`. Internal only. `init.sql` creates `pgcrypto` and `pg_trgm` when the volume is first initialized. |
| `redis` | Redis 7 (BullMQ report queue) | Volume `leaderprism_redisdata`. Internal only, no password, `noeviction`. |
| `leaderprism-api` | NestJS API, port 3001 | On `edge`. Report PDFs go to volume `leaderprism_reports` (`/app/reports`). |
| `leaderprism-web` | Next.js app, port 3000 | On `edge`. |
| `leaderprism-landing` | Landing static export on nginx, port 80 | On `edge` only. |

Nothing publishes a port. BizOS's Caddy container owns 80/443 and routes the two
hostnames over the shared `edge` network. Those site blocks are at the end of
`/opt/bizos/Caddyfile`:

- `leaderprism.*`: `/api/*` → `leaderprism-api:3001`, everything else → `leaderprism-web:3000`.
  Web and API share one host on purpose: the refresh-token cookie is
  `SameSite=Strict`, so a separate API hostname would break token refresh.
- `leaderprism-landing.*` → `leaderprism-landing:80`.

The services are called `leaderprism-*` rather than `api` / `web` because service
names become DNS names on `edge`, and other tenants already use the plain ones.
That is also why the web build sets `INTERNAL_API_URL=http://leaderprism-api:3001`:
`next.config.mjs` bakes it into the `/api` rewrite at build time, and plain `api`
on that network would reach another tenant's API.

## How a deploy works

On push to `master` (or a manual run), `deploy-dev.yml`:

1. Runs `npm ci` and builds `shared`, `api`, `web` and `landing` on the runner.
   The web build gets `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_LANDING_URL` and
   `INTERNAL_API_URL`, and the landing build gets `NEXT_PUBLIC_APP_URL`. Next.js
   inlines all of these at build time, so changing a hostname means rebuilding.
2. Packages the build output into three images with `api/Dockerfile`,
   `web/Dockerfile` and `landing/Dockerfile` (context = repo root, filtered by
   `.dockerignore`) and pushes them to GHCR as `dev-latest` and `sha-<short>`.
3. Copies `deploy/hostinger/docker-compose.yml` and `api/src/database/init.sql`
   to `/opt/leaderprism/`, and syncs `OPENAI_API_KEY` into `.env` (see below).
4. Pulls the images, starts `postgres` + `redis`, then runs the TypeORM
   migrations, `run-seeds.js` and `run-thrivehive-seed.js` in one-off containers
   of the new API image. Only then does it run `docker compose up -d`. Every seed
   checks before it inserts, so re-running them is safe.
5. Fails unless the API answers below 500 on `/api/v1/organisations/me` (there is
   no health endpoint, so a 401 counts as up), and `/login` and the landing root
   both return 2xx, within 5 minutes.

### GitHub secrets

| Secret | Required | Value |
| :--- | :--- | :--- |
| `VM_SSH_KEY` | Yes | The `bizosadmin` private key (the same key BizOS, LMS and ocean-view-hotel-tv CI use). |
| `OPENAI_API_KEY` | No | Copied into `/opt/leaderprism/.env` on each deploy when set (web AI assistant). |
| `GHCR_PULL_TOKEN` | No | A PAT with `read:packages`. The VPS's docker is already logged in to GHCR, so this is only needed if that login lapses. |

The old Azure secrets (`DEV_VM_IP`, `SSH_PRIVATE_KEY`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`,
`AZURE_STATIC_WEB_APPS_API_TOKEN_LANDING`) are no longer used by any workflow.

## Runtime configuration — `/opt/leaderprism/.env`

All runtime secrets live only in `/opt/leaderprism/.env` on the VPS (mode 600,
owned by `bizosadmin`), apart from `OPENAI_API_KEY`, which CI keeps in sync from
the GitHub secret. The full list is in
[deploy/hostinger/.env.example](deploy/hostinger/.env.example).

To change a value:

```bash
ssh bizosadmin@187.127.182.104
cd /opt/leaderprism
nano .env
docker compose up -d        # recreates whichever containers' config changed
```

`POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` were generated
randomly on the VPS when the environment was created. Changing
`POSTGRES_PASSWORD` after the first start does **not** change the database
user's password, which is fixed when the volume is initialized. Change it in
Postgres first (`ALTER USER leaderprism PASSWORD '...'`) or the API will fail to
connect. Rotating either JWT secret logs everyone out.

### Email (log-only)

Email is **not sent** on this environment. `AZURE_COMMUNICATION_CONNECTION_STRING`
is empty, so `NotificationsService` writes each message to the API log instead,
including welcome-email temporary passwords, rater links and password-reset
links. To find one:

```bash
cd /opt/leaderprism
docker compose logs leaderprism-api | grep '\[EMAIL\]'
```

The Azure Communication Services resource the Azure VM used
(`leaderprism-comms-dev`) lives in the subscription that is being disabled. To
send for real, set `AZURE_COMMUNICATION_CONNECTION_STRING` and `EMAIL_FROM` (a
verified sender on that resource) in `.env` and run `docker compose up -d`, or
add an SMTP mode to `NotificationsService` and use Google Workspace's relay the
way LMS and BizOS on this VPS do.

### Report PDFs

`PdfService` renders with the Alpine Chromium in the API image and writes to
`/app/reports`, which is the `leaderprism_reports` volume, so reports survive
redeploys. There is no blob storage.

## Seeded accounts

The seeds run on every deploy. They only create rows that don't exist yet and
never reset passwords.

| Account | Password |
| :--- | :--- |
| `admin@acme.com` (Acme demo org) | Hard-coded in `api/src/database/seeds/admin.seed.ts`. |
| Thrive Hive tenant admin | Hard-coded in `api/src/database/seeds/thrivehive-tenant.seed.ts`; must be changed on first login. |

Both are in this public repository. Change them after first login.

## Operations

```bash
cd /opt/leaderprism

docker compose ps
docker compose logs -f leaderprism-api            # or leaderprism-web / postgres
docker compose exec postgres psql -U leaderprism  # database shell

# Manual deploy of whatever is currently tagged dev-latest on GHCR
# (skips migrations/seeds — run those as in deploy-dev.yml if the schema changed)
docker compose pull leaderprism-api leaderprism-web leaderprism-landing && docker compose up -d

# Run migrations by hand
docker compose run --rm --no-deps -T leaderprism-api \
  npx typeorm migration:run -d api/dist/api/src/database/data-source.js

# Pin a specific build instead (sha tags come from CI)
docker pull ghcr.io/techneura2026/leadership/api:sha-abc1234
docker tag  ghcr.io/techneura2026/leadership/api:sha-abc1234 ghcr.io/techneura2026/leadership/api:dev-latest
docker compose up -d leaderprism-api
```

**Wipe the dev database.** The next deploy re-creates, migrates and re-seeds it.
Until then the API has no tables.

```bash
docker compose down
docker volume rm leaderprism_pgdata
# then re-run the "Deploy LeaderPrism" workflow (Actions → Run workflow)
```

**Caddy** (BizOS-owned; affects every app on the box): back up
`/opt/bizos/Caddyfile` before editing, then validate and reload gracefully
instead of restarting:

```bash
sudo cp -p /opt/bizos/Caddyfile /opt/bizos/Caddyfile.bak.$(date +%s)
sudo nano /opt/bizos/Caddyfile   # edits in place; the file is bind-mounted, don't replace it
docker exec bizos-caddy-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec bizos-caddy-1 caddy reload   --config /etc/caddy/Caddyfile --adapter caddyfile
```

## The old Azure environment

The VPS database started empty (migrated and seeded, no Azure dev data). The
Azure resources in resource group `leaderprism-rg-dev` ("Leadership"
subscription) were left in place: the VM `leaderprism-vm-dev` (stopped, not
deallocated), its Postgres data on the OS disk, the `leaderprism-landing-dev`
Static Web App, the `leaderprism-comms-dev` ACS resource and the
`leaderprismstdev` storage account. Nothing on the VPS depends on them.
`infra/terraform/` still describes that environment.
