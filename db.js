/**
 * db.js  (Postgres / Supabase)
 * ----------------------------
 * Async data-access layer backed by Postgres via the `pg` driver.
 *
 *  - Production: set DATABASE_URL (Supabase, Render Postgres, Neon, ...).
 *  - Local dev:  if DATABASE_URL is empty, we fall back to PGlite — an
 *    in-process Postgres (WASM) that persists to ./data/pgdata. This lets the
 *    app run with zero setup locally while using the SAME SQL as production.
 *
 * Everything here is async. Call `await init()` once at startup before serving.
 *
 * Helpers:
 *   query(text, params)  -> { rows, rowCount }
 *   get(text, params)    -> first row | undefined
 *   all(text, params)    -> rows[]
 *   run(text, params)    -> { rows, rowCount }
 *   exec(sql)            -> run a multi-statement SQL string (no params)
 *   tx(async (q) => ...) -> run a function inside a transaction (q = bound query)
 */

'use strict';

const path = require('path');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL || '';
const USING_PG = !!DATABASE_URL;

let pool = null;     // pg.Pool (production)
let pglite = null;   // PGlite instance (local dev fallback)

function pgSslOption() {
  if (process.env.PGSSL === 'disable') return false;
  if (/localhost|127\.0\.0\.1/.test(DATABASE_URL)) return false;
  // Managed providers (Supabase/Render/Neon) require SSL; their certs aren't in
  // Node's trust store, so disable strict verification.
  return { rejectUnauthorized: false };
}

async function connect() {
  if (USING_PG) {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: DATABASE_URL, ssl: pgSslOption(), max: 10 });
    // Fail fast if the connection string is bad.
    const c = await pool.connect();
    c.release();
    console.log('  DB: connected to Postgres via DATABASE_URL');
  } else {
    const dir = path.join(__dirname, 'data', 'pgdata');
    fs.mkdirSync(dir, { recursive: true });
    let PGlite;
    try {
      ({ PGlite } = await import('@electric-sql/pglite'));
    } catch (e) {
      throw new Error(
        'No DATABASE_URL set and PGlite (dev fallback) is not installed. ' +
          'Set DATABASE_URL to your Postgres/Supabase connection string, or run `npm install`.'
      );
    }
    pglite = new PGlite(dir);
    await pglite.query('SELECT 1');
    console.log('  DB: using local PGlite (dev) at ./data/pgdata — set DATABASE_URL for production');
  }
}

async function query(text, params = []) {
  if (USING_PG) return pool.query(text, params);
  return pglite.query(text, params);
}
async function exec(sql) {
  if (USING_PG) return pool.query(sql);
  return pglite.exec(sql);
}
async function get(text, params = []) { return (await query(text, params)).rows[0]; }
async function all(text, params = []) { return (await query(text, params)).rows; }
async function run(text, params = []) { return query(text, params); }

/** Run fn inside a transaction. fn receives a bound query(text, params). */
async function tx(fn) {
  if (USING_PG) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await fn((t, p = []) => client.query(t, p));
      await client.query('COMMIT');
      return r;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } else {
    await pglite.query('BEGIN');
    try {
      const r = await fn((t, p = []) => pglite.query(t, p));
      await pglite.query('COMMIT');
      return r;
    } catch (e) {
      await pglite.query('ROLLBACK');
      throw e;
    }
  }
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS teams (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    code          TEXT,
    confederation TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS players (
    id         SERIAL PRIMARY KEY,
    team_id    INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    fan_team_id   INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    insta_url     TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS matches (
    id                    SERIAL PRIMARY KEY,
    home_team_id          INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    away_team_id          INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    kickoff               TEXT NOT NULL,
    stage                 TEXT,
    lock_at               TEXT,
    manual_lock           TEXT NOT NULL DEFAULT 'auto',
    status                TEXT NOT NULL DEFAULT 'scheduled',
    result_winner_team_id INTEGER REFERENCES teams(id),
    result_outcome        TEXT,
    result_mvp_player_id  INTEGER REFERENCES players(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS predictions (
    id                       SERIAL PRIMARY KEY,
    user_id                  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id                 INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    predicted_winner_team_id INTEGER,
    predicted_outcome        TEXT,
    predicted_mvp_player_id  INTEGER,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, match_id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS leagues (
    id         SERIAL PRIMARY KEY,
    code       TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    owner_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS league_members (
    league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (league_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_pred_match ON predictions(match_id);
  CREATE INDEX IF NOT EXISTS idx_pred_user ON predictions(user_id);
  CREATE INDEX IF NOT EXISTS idx_match_status ON matches(status);
  CREATE INDEX IF NOT EXISTS idx_league_member_user ON league_members(user_id);
`;

/** Idempotent column additions so older databases upgrade cleanly. */
async function migrate() {
  const adds = [
    `ALTER TABLE teams ADD COLUMN IF NOT EXISTS confederation TEXT`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS lock_at TEXT`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS manual_lock TEXT NOT NULL DEFAULT 'auto'`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS result_outcome TEXT`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS result_mvp_player_id INTEGER`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS predicted_outcome TEXT`,
    `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS predicted_mvp_player_id INTEGER`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS fan_team_id INTEGER`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS insta_url TEXT`,
  ];
  for (const sql of adds) await query(sql);
}

const DEFAULT_SETTINGS = {
  points_winner: '3',
  points_mvp: '5',
  odds_scale: '10',
  leaderboard_size: '100',
  lock_minutes: '2',
  min_predictions: '5',
  site_title: 'Fun Football',
  site_tagline: 'Predict the 2026 World Cup. Climb the leaderboard. ⚽',
  promo_enabled: '1',
  promo_type: 'text',
  promo_title: 'Featured',
  promo_text: 'Welcome to Fun Football! Pick the winner and the MVP for every match.',
  promo_image_url: '',
  promo_insta: '',
  promo_link: '',
  disclaimer:
    'This is a free, fun prediction game for entertainment and bragging rights only. ' +
    'No money or anything of value is wagered, staked, or exchanged — this is NOT gambling or betting. ' +
    'Participation is completely free and purely for sportive fun among football fans. ' +
    'Any post-tournament giveaways are goodwill gestures, not contingent on your predictions or rank, ' +
    'and have no connection to betting of any kind.',
};

async function seedDefaultSettings() {
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    await query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [k, v]);
  }
}

/* ----------------------------- Settings helpers (async) ----------------------------- */
async function getSetting(key) {
  const row = await get('SELECT value FROM settings WHERE key = $1', [key]);
  return row ? row.value : undefined;
}
async function getSettingNumber(key, fallback = 0) {
  const n = Number(await getSetting(key));
  return Number.isFinite(n) ? n : fallback;
}
async function setSetting(key, value) {
  await query(
    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
    [key, value == null ? '' : String(value)]
  );
}
async function getAllSettings() {
  const rows = await all('SELECT key, value FROM settings');
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

let _initialised = false;
async function init() {
  if (_initialised) return;
  await connect();
  await exec(SCHEMA);
  await migrate();
  await seedDefaultSettings();
  _initialised = true;
}

module.exports = {
  init,
  query, get, all, run, exec, tx,
  getSetting, getSettingNumber, setSetting, getAllSettings,
  DEFAULT_SETTINGS,
  USING_PG,
};
