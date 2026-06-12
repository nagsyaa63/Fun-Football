# 🚀 Deploying Fun Football (Postgres / Supabase)

Fun Football stores everything in a **Postgres** database, so your users and
predictions **persist** across restarts and redeploys. You provide a Postgres
connection string via the **`DATABASE_URL`** environment variable. Any Postgres
works — **Supabase**, **Render Postgres**, **Neon**, etc.

> **Before you deploy — set these env vars on your host:**
> | Variable | Required | Purpose |
> |----------|----------|---------|
> | `DATABASE_URL` | **yes** | Postgres connection string (Supabase/Render/Neon) |
> | `ADMIN_PASSWORD` | **yes** | Password for the `/admin` panel |
> | `SESSION_SECRET` | **yes** | Signs admin + user tokens — keep it **stable** in production |
> | `PORT` | no | Defaults to `3000` (most hosts set this for you) |
>
> Generate a secret with: `openssl rand -hex 32`

> 💡 **Local dev needs no database** — leave `DATABASE_URL` blank and the app
> uses an in-process PGlite database under `./data/pgdata`.

---

## Step 1 — Create a Postgres database

### Option A: Supabase (free, recommended)

1. Go to <https://supabase.com> → **New project**. Pick a name, a strong
   **database password**, and a region close to your users.
2. Wait for it to provision, then open **Project Settings → Database**.
3. Under **Connection string**, copy the **URI** (it looks like):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.<ref>.supabase.co:5432/postgres
   ```
   Replace `[YOUR-PASSWORD]` with the password you chose.
   - For serverless/edge hosts you may prefer the **Connection Pooling** URI
     (port `6543`). For a normal Node server the direct `5432` URI is fine.
4. That whole URI is your **`DATABASE_URL`**. (SSL is handled automatically.)

### Option B: Render Postgres

1. <https://render.com> → **New → PostgreSQL**. Choose a name/region; create it.
2. Copy the **External Connection String** (or *Internal* if your web service is
   on Render too) — that's your `DATABASE_URL`.

### Option C: Neon

1. <https://neon.tech> → create a project → copy the **connection string**
   (make sure it includes `?sslmode=require`). That's your `DATABASE_URL`.

---

## Step 2 — Deploy the app

### Render (Web Service) — easiest

1. Push this project to **GitHub** (see bottom of this file).
2. Render → **New → Web Service** → connect the repo.
3. Settings:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. **Environment** → add `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`.
5. Create the service. Render builds and gives you a public HTTPS URL.
6. **Seed once** (loads the 48 teams + squads + sample matches): open the
   service's **Shell** tab and run:
   ```bash
   npm run seed
   ```
   (Or run it locally with the same `DATABASE_URL` set in your `.env`.)

Your site is live at the Render URL; admin is at `<url>/admin`.

> No persistent disk is needed — all data lives in Postgres.

### Railway

1. <https://railway.app> → **New Project** → **Deploy from GitHub repo**
   (or add the Railway Postgres plugin and use its `DATABASE_URL`).
2. Add `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET` under **Variables**.
3. Deploy, then run `npm run seed` once (Railway shell) to load the teams.

### Fly.io (Docker)

```bash
fly launch --no-deploy
fly secrets set DATABASE_URL="postgres://..." ADMIN_PASSWORD="..." SESSION_SECRET="$(openssl rand -hex 32)"
fly deploy
fly ssh console -C "npm run seed"   # one-time seed
```

### Docker (any host)

```bash
docker build -t fun-football .
docker run -d --name fun-football -p 3000:3000 \
  -e DATABASE_URL="postgres://..." \
  -e ADMIN_PASSWORD="your-secret" \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  fun-football
docker exec -it fun-football npm run seed   # one-time seed
```

### Plain VPS (Ubuntu) with PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
git clone <your-repo-url> fun-football && cd fun-football
npm install
cp .env.example .env     # set DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET
npm run seed
sudo npm install -g pm2
pm2 start server.js --name fun-football && pm2 save && pm2 startup
```
Put Nginx + Certbot in front for HTTPS (see any standard Node + Nginx guide).

---

## Step 3 — Seeding & schema

- The app **creates its tables automatically** on first boot (`db.init()`), so
  you don't run any migrations by hand.
- `npm run seed` **clears game data** (teams, players, matches, predictions) and
  reloads the 48 World Cup squads + a few sample fixtures. **It keeps users and
  settings.** Run it once after first deploy; re-run only if you want to reset
  teams/matches.
- To start completely fresh, drop the tables in your Postgres dashboard and let
  the app recreate them on next boot, then seed.

---

## Backups

Use your provider's built-in backups:

- **Supabase:** Database → Backups (daily automated on paid; manual export via
  `pg_dump` otherwise).
- **Render/Neon:** automated backups in the dashboard.

Manual dump anywhere:
```bash
pg_dump "$DATABASE_URL" > funfootball-backup-$(date +%F).sql
```

---

## Pushing to GitHub (first time)

```bash
cd fun-football
git init && git add . && git commit -m "Fun Football"
git branch -M main
git remote add origin https://github.com/<you>/fun-football.git
git push -u origin main
```

> `.gitignore` excludes `node_modules/`, `.env`, and the local `data/` (PGlite)
> folder, so secrets and the dev DB are never committed.

---

## Environment variables reference

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DATABASE_URL` | **yes (prod)** | _(blank → PGlite dev DB)_ | Postgres connection string |
| `ADMIN_PASSWORD` | **yes** | `changeme123` | Password for `/admin` |
| `SESSION_SECRET` | **yes** | dev value | Signs admin + user tokens (keep stable!) |
| `PORT` | no | `3000` | Port the server listens on |
| `PGSSL` | no | _(SSL on for remote)_ | Set `disable` to turn off SSL (e.g. local Postgres) |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Failed to start (database init error)` | `DATABASE_URL` wrong/unreachable, or password not URL-encoded. Test it with `psql "$DATABASE_URL"`. |
| `self signed certificate` / SSL errors | The app already sets `ssl: { rejectUnauthorized: false }` for remote URLs. For a local Postgres without SSL set `PGSSL=disable`. |
| Leaderboard empty | Normal until matches are marked **finished** in the admin **Results & Lock** tab. |
| Teams/players missing | Run `npm run seed` once (host shell) — or add them in the admin panel. |
| Everyone got logged out after a deploy | You changed `SESSION_SECRET`. Keep it constant in production. |
| Times look off | Kickoffs are stored in UTC; the site shows each visitor's local time, and leaderboards show IST + UTC. |
