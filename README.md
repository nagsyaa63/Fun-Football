# ⚽ Fun Football — 2026 World Cup Predictions

A simple, fun website where people predict 2026 FIFA World Cup matches.
For every match, players make **two predictions**:

1. 🏆 **The result** — Home win / 🤝 Draw / Away win
2. ⭐ **The MVP** (Man of the Match) — any player from either team

Predictions **lock before kickoff** (per-match lock time, with a manual admin
override). Once a match locks, everyone can see **how the crowd voted**. Points
reward **bold, correct calls** more than obvious ones (see *Giant Slayer*
scoring below), players climb **football titles**, and there are several
**leaderboards** to compete on.

It ships with an **admin panel** to manage teams, players, matches, locking,
results, an editable homepage **promo/ad box**, and to see registered users.

> 💛 **Not gambling.** This is a free, for-fun prediction game — no money is
> wagered or exchanged. An editable disclaimer is shown on the site.

---

## ✨ Features

- **Username + password accounts.** Every user gets a unique internal ID (e.g.
  `U7F3K9Q`) used to track them everywhere. Passwords are stored salted &
  hashed (scrypt). A stateless login token authorises profile edits.
- **Editable profile**: display **username**, a **fan team** (optional), and a
  **private Instagram** handle. 🔒 The Instagram is visible **only to admins**
  (for reaching out about post-tournament goodies) — never to other users.
- **Two predictions per match**: result (Home/Draw/Away) + MVP (auto-filled with
  every player from both teams).
- **🗡️ Giant Slayer scoring (ratio-based).** A correct result is worth more the
  **fewer people** who backed it:
  `points = max(1, round((1 − your_pick's_vote_share) × oddsScale))`
  (oddsScale default 10). So if only 10% picked the actual result, they earn ~9;
  if 90% picked it, ~1. Correct MVP = a flat **+5**. **Overall = Giant Slayer +
  MVP.** This rewards backing underdogs instead of always picking the favourite.
- **Crowd vote breakdown.** Once a match locks, each card shows the % who picked
  Home / Draw / Away (hidden while open so it can't sway picks).
- **🏟️ Friend leagues.** Create a private league, share its invite code, and see
  a leaderboard filtered to just your friends — switch between Global and any of
  your leagues from a selector on the leaderboard.
- **Share buttons.** Share your locked-in pick or your post-match result to
  WhatsApp / Instagram / anywhere via the native share sheet (clipboard fallback)
  — no external service required.
- **🗡️ Giant Slayer spotlight.** The homepage highlights the boldest correct call
  so far (the biggest upset that someone nailed).
- **Post-match breakdown + "you earned".** Each finished match shows
  *"only X% backed this → +N pts"* and exactly what you personally earned.
- **In-app scoring explainer** (the **❓ Scoring** button) so the ratio system
  never feels random.
- **Match grouping** on the homepage: **🟢 Open** (soonest to lock first) →
  **🔒 Locked** (most recently locked first) → **✅ Finished**.
- **Four leaderboards**: **Overall**, **🗡️ Giant Slayer**, **⭐ MVP**, and
  **📊 Average** (min predictions required). Each shows only the **top N**
  (admin-configurable, default 100), a **"last updated"** time in **IST & UTC**,
  and **your own standing** even if you're outside the top N.
- **Football titles** by total points: Debutant → Squad Player → First XI →
  Playmaker → Star Striker → Captain → Maestro → Legend → 🐐 GOAT (editable).
- **Personal stats** (title, points, matches, accuracy, per-board points & ranks).
- **Per-match lock time + manual override** (force open / force locked), enforced
  server-side, with live countdowns.
- **Admin panel** with a dashboard, match **IDs/serial numbers** shown
  everywhere (so you know exactly which match you're editing), result entry,
  lock control, an editable promo/ad box, scoring/rules, and a **Users** view
  (with the private Instagram handles).
- **All 48 qualified 2026 teams + full squads (~1,246 players)** pre-seeded.
- **Light / dark theme** toggle. Football night-pitch theme. **Zero build step**:
  plain HTML/CSS/JS + Node/Express + Postgres.

---

## 🧱 Tech stack

| Layer    | Choice                          | Why |
|----------|---------------------------------|-----|
| Backend  | Node.js + Express               | Tiny, ubiquitous, easy to host |
| Database | **Postgres** (`pg`)             | Durable, managed persistence (Supabase / Render / Neon) |
| Dev DB   | PGlite (in-process Postgres)    | Zero-setup local dev when `DATABASE_URL` is unset |
| Frontend | Vanilla HTML/CSS/JS             | No build tooling, loads instantly |
| Auth     | Username + password (scrypt); admin password | Simple, no third-party login |

---

## 🚀 Quick start (local)

> Requires **Node.js 18+**.

```bash
cd fun-football
npm install

cp .env.example .env          # edit ADMIN_PASSWORD + SESSION_SECRET
#   Leave DATABASE_URL BLANK to use the built-in local PGlite database (no setup),
#   or set it to a Supabase/Postgres URL to use a real database locally too.
npm run seed                  # loads all 48 teams + full squads + sample matches
npm start
```

- **Public site:** http://localhost:3000
- **Admin panel:** http://localhost:3000/admin  (log in with `ADMIN_PASSWORD`)

> 👉 Hosting it online? See **[DEPLOY.md](./DEPLOY.md)**.

---

## 🕹️ How to use it

### As a player
1. Click **Log in / Sign up**, pick a username and password (≥6 chars). You get a unique ID.
2. In the **🟢 Open** group, choose the **result** and the **MVP** for each match, then **Save prediction**. Edit any time until it locks.
3. After a match **locks**, see the **crowd vote %**. After it **finishes**, see the result and your points.
4. Open **Profile** to set your **fan team** and **private Instagram**, and to view your points & rank on every board.
5. Watch your **title** climb and track the **Leaderboards**.

### As the admin
1. Go to `/admin` and log in with the admin password.
2. **Teams / Players** are pre-seeded with all 48 squads — edit/add as needed.
3. **Matches** → create a fixture (Team A, Team B, kickoff, optional lock time, manual lock override). Every match shows a **#ID**.
4. **Results & Lock** → set the **result** (Home/Draw/Away) and **MVP**, then **Save result & finish** (leaderboards update instantly). Use **Force Open / Force Lock** to override the clock. **Reopen** undoes a result.
5. **Users** → see who joined and their **private** Instagram handles.
6. **Promo & Settings** → edit the promo/ad box, scoring (**odds scale**, MVP points), lock window, **min predictions**, **leaderboard size (top N)**, the disclaimer, and the title tiers.

---

## 🏆 Scoring & titles (configurable in admin)

- **Result (Giant Slayer):** `max(1, round((1 − vote_share_of_actual_result) × oddsScale))`, `oddsScale` default **10**.
  Examples: 50% → 5, 40% → 6, 10% → 9, 90% → 1.
- **MVP:** flat **+5** for a correct pick.
- **Overall** = Giant Slayer + MVP. **Average** = Overall ÷ matches played (needs ≥ `min_predictions`, default 5).
- Scores recompute on the fly, so editing a result or a setting updates every board instantly.

**Title tiers** (by total points, scaled to the 104-match tournament; editable as JSON):
`Debutant 0 · Squad Player 40 · First XI 100 · Playmaker 200 · Star Striker 350 · Captain 550 · Maestro 800 · Legend 1100 · GOAT 1450`.

---

## 🗃️ Database design

Postgres (set `DATABASE_URL`; local dev falls back to PGlite under `./data/pgdata`).

**users**: `id` (public ID), `username` (unique), `password_hash` (scrypt),
`fan_team_id → teams.id`, `insta_url` (private), `created_at`

**teams**: `id`, `name`, `code` (flag), `confederation`, `created_at`

**players**: `id`, `team_id → teams.id`, `name`, `created_at`

**matches**: `id`, `home_team_id`, `away_team_id`, `kickoff` (UTC ISO), `stage`,
`lock_at` (optional), `manual_lock` (`auto`|`locked`|`open`), `status`
(`scheduled`|`finished`), `result_outcome` (`home`|`away`|`draw`),
`result_mvp_player_id`

**predictions** (unique per user+match): `id`, `user_id`, `match_id`,
`predicted_outcome` (`home`|`away`|`draw`), `predicted_mvp_player_id`, timestamps

**settings**: key/value (scoring `odds_scale`/`points_mvp`, `leaderboard_size`,
`lock_minutes`, `min_predictions`, branding, promo box, disclaimer, titles JSON)

---

## 🔌 API (brief)

**Public**
- `POST /api/users/join` — `{ username, password }` → `{ id, username, token, fanTeamId }` (registers or logs in)
- `GET  /api/users/:id/profile?token=` — profile (Instagram only with owner token)
- `POST /api/users/profile` — `{ userId, token, username, fanTeamId, instaUrl }`
- `GET  /api/users/:id/stats` — points + rank on every board + title
- `GET  /api/public/settings` · `GET /api/teams`
- `GET  /api/matches?userId=` — matches incl. lock state + vote % (when locked)
- `POST /api/predictions` — `{ userId, matchId, outcome, mvpPlayerId }`
- `GET  /api/leaderboards` — top-N boards + `generatedAt` + `spotlight`
- `POST /api/leagues` · `POST /api/leagues/join` · `GET /api/leagues/mine` · `GET /api/leagues/:code/leaderboard` (friend leagues)

**Admin** (require the `ff_admin` cookie; login is rate-limited)
- `POST /api/admin/login` · `logout` · `GET /api/admin/me` · `GET /api/admin/stats` · `GET /api/admin/users`
- CRUD `teams` / `players` / `matches` · `POST /api/admin/matches/:id/lock` · `/result` · `GET/PUT /api/admin/settings`

---

---

## 📈 Scaling notes (5k–25k users)

The app runs as a **single Node process backed by managed Postgres** (Supabase /
Render / Neon). Data persists in the database — redeploys/restarts never lose it.

- **Postgres connection pool** (`pg`, up to 10 connections) handles the
  pre-kickoff write rush (many users saving predictions at once).
- **Indexes** on `predictions(match_id)`, `predictions(user_id)`,
  `matches(status)` and `league_members(user_id)` keep queries fast.
- Leaderboards are computed from all predictions, so the result is **cached
  in-memory for ~10s** and **invalidated instantly** when a result/setting
  changes. A burst of leaderboard/standings requests collapses to one
  computation — this is the main cost, and the cache removes it.
- Only the **top N** (default 100) is sent to clients; your own rank is computed
  separately so big boards stay light.

For local development you don't even need Postgres installed — leave
`DATABASE_URL` blank and the app uses **PGlite** (an in-process Postgres) stored
under `./data/pgdata`.

---

## 🔒 Security notes

- Change **`ADMIN_PASSWORD`** and **`SESSION_SECRET`** before deploying.
- User passwords are salted + hashed with scrypt. Still, treat this as a **fun,
  low-stakes** app — don't reuse an important password.
- The profile Instagram is private (admin-only); it's never returned to other users.
- Put the site behind **HTTPS** in production (every host in DEPLOY.md does this).

---

## 📜 License

MIT — have fun! ⚽
