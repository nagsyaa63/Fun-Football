/**
 * server.js (Postgres / async)
 * ----------------------------
 * Express server. Public API (join, matches, predictions, leaderboards, leagues,
 * profile, promo) + password-protected admin API. Backed by Postgres (Supabase /
 * Render / Neon) via DATABASE_URL, with a local PGlite fallback for dev.
 */

'use strict';

require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');

const db = require('./db');
const { computeLeaderboards, leagueBoards, userStanding, getTitles, invalidate } = require('./scoring');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const IS_PROD = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Wrap async route handlers so rejected promises become 500s instead of hangs.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ------------------------------- Utilities -------------------------------- */
function sha256(input) { return crypto.createHash('sha256').update(String(input)).digest('hex'); }

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const dk = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return `scrypt$${salt}$${dk}`;
}
function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const dk = crypto.scryptSync(String(password), salt, 32).toString('hex');
  const a = Buffer.from(dk, 'hex'), b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function userToken(id) { return crypto.createHmac('sha256', SESSION_SECRET).update('user:' + id).digest('hex'); }
function verifyUserToken(id, token) {
  if (!id || !token) return false;
  const a = Buffer.from(String(token)), b = Buffer.from(userToken(id));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function generateUserId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'U';
  const bytes = crypto.randomBytes(7);
  for (let i = 0; i < 7; i++) id += alphabet[bytes[i] % alphabet.length];
  return id;
}
function adminToken() { return crypto.createHmac('sha256', SESSION_SECRET).update('admin-v2').digest('hex'); }
function safeEqual(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
function isAdmin(req) { return req.cookies && req.cookies.ff_admin === adminToken(); }
function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Admin authentication required.' });
  next();
}
function asInt(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

/** Lock state for a match. Manual override beats the clock. lockMinutes passed in. */
function lockState(match, lockMinutes) {
  const kickoffMs = new Date(match.kickoff).getTime();
  const effectiveLockMs = match.lock_at ? new Date(match.lock_at).getTime() : kickoffMs - lockMinutes * 60 * 1000;
  const lockAtIso = new Date(effectiveLockMs).toISOString();
  if (match.status === 'finished') return { locked: true, lockAt: lockAtIso };
  if (match.manual_lock === 'locked') return { locked: true, lockAt: lockAtIso };
  if (match.manual_lock === 'open') return { locked: false, lockAt: lockAtIso };
  return { locked: Date.now() >= effectiveLockMs, lockAt: lockAtIso };
}

/* ============================== PUBLIC API ================================= */

app.post('/api/users/join', wrap(async (req, res) => {
  let { username, password } = req.body || {};
  username = (username || '').trim();
  password = (password || '').toString();
  if (username.length < 2 || username.length > 24) return res.status(400).json({ error: 'Username must be 2-24 characters.' });
  if (password.length < 6 || password.length > 64) return res.status(400).json({ error: 'Password must be 6-64 characters.' });

  const existing = await db.get('SELECT * FROM users WHERE lower(username) = lower($1)', [username]);
  if (existing) {
    if (!verifyPassword(password, existing.password_hash)) return res.status(401).json({ error: 'Wrong password (or that username is taken).' });
    return res.json({ id: existing.id, username: existing.username, token: userToken(existing.id), fanTeamId: existing.fan_team_id || null, returning: true });
  }
  let id = generateUserId();
  for (let i = 0; i < 5; i++) { if (!(await db.get('SELECT 1 FROM users WHERE id = $1', [id]))) break; id = generateUserId(); }
  await db.run('INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)', [id, username, hashPassword(password)]);
  res.json({ id, username, token: userToken(id), fanTeamId: null, returning: false });
}));

function authForProfile(body) {
  if (body && body.userId && body.token && verifyUserToken(body.userId, body.token)) return body.userId;
  return null;
}

app.get('/api/users/:id/profile', wrap(async (req, res) => {
  const u = await db.get(
    `SELECT u.id, u.username, u.fan_team_id, u.insta_url, t.name AS fan_name, t.code AS fan_code
     FROM users u LEFT JOIN teams t ON t.id = u.fan_team_id WHERE u.id = $1`, [req.params.id]
  );
  if (!u) return res.status(404).json({ error: 'User not found.' });
  const isOwner = verifyUserToken(req.params.id, req.query.token);
  res.json({
    id: u.id, username: u.username,
    fanTeamId: u.fan_team_id || null, fanTeamName: u.fan_name || null, fanTeamCode: u.fan_code || null,
    instaUrl: isOwner ? (u.insta_url || '') : undefined,
  });
}));

app.post('/api/users/profile', wrap(async (req, res) => {
  const body = req.body || {};
  const userId = authForProfile(body);
  if (!userId) return res.status(401).json({ error: 'Please log in again to edit your profile.' });
  const user = await db.get('SELECT * FROM users WHERE id = $1', [userId]);
  if (!user) return res.status(401).json({ error: 'Unknown user.' });

  let username = (body.username || '').trim();
  const fanTeamId = asInt(body.fanTeamId);
  let instaUrl = (body.instaUrl || '').trim().slice(0, 200);

  if (username) {
    if (username.length < 2 || username.length > 24) return res.status(400).json({ error: 'Username must be 2-24 characters.' });
    const clash = await db.get('SELECT id FROM users WHERE lower(username) = lower($1) AND id <> $2', [username, user.id]);
    if (clash) return res.status(409).json({ error: 'That username is taken.' });
  } else username = user.username;

  if (fanTeamId !== null && !(await db.get('SELECT 1 FROM teams WHERE id = $1', [fanTeamId]))) {
    return res.status(400).json({ error: 'Unknown team.' });
  }
  if (instaUrl && !/^(https?:\/\/|@|instagram\.com)/i.test(instaUrl)) instaUrl = 'https://instagram.com/' + instaUrl.replace(/^@/, '');

  await db.run('UPDATE users SET username=$1, fan_team_id=$2, insta_url=$3 WHERE id=$4', [username, fanTeamId, instaUrl, user.id]);
  res.json({ ok: true, id: user.id, username, fanTeamId, instaUrl });
}));

app.get('/api/public/settings', wrap(async (req, res) => {
  const s = await db.getAllSettings();
  res.json({
    siteTitle: s.site_title, siteTagline: s.site_tagline,
    oddsScale: Number(s.odds_scale), pointsMvp: Number(s.points_mvp),
    minPredictions: Number(s.min_predictions), leaderboardSize: Number(s.leaderboard_size),
    lockMinutes: Number(s.lock_minutes), disclaimer: s.disclaimer || '',
    titles: await getTitles(),
    promo: {
      enabled: s.promo_enabled === '1', type: s.promo_type, title: s.promo_title,
      text: s.promo_text, imageUrl: s.promo_image_url, insta: s.promo_insta, link: s.promo_link,
    },
  });
}));

app.get('/api/teams', wrap(async (req, res) => {
  res.json({ teams: await db.all('SELECT id, name, code, confederation FROM teams ORDER BY name') });
}));

async function getMatchPlayers(homeTeamId, awayTeamId) {
  return db.all(
    `SELECT p.id, p.name, p.team_id AS "teamId", t.name AS "teamName"
     FROM players p JOIN teams t ON t.id = p.team_id
     WHERE p.team_id IN ($1, $2) ORDER BY t.name, p.name`, [homeTeamId, awayTeamId]
  );
}

app.get('/api/matches', wrap(async (req, res) => {
  const userId = (req.query.userId || '').toString().trim() || null;
  const lockMinutes = await db.getSettingNumber('lock_minutes', 2);
  const oddsScale = await db.getSettingNumber('odds_scale', 10);
  const pointsMvp = await db.getSettingNumber('points_mvp', 5);

  const matches = await db.all(
    `SELECT m.*, ht.name AS home_name, ht.code AS home_code, at.name AS away_name, at.code AS away_code,
            mvp.name AS result_mvp_name
     FROM matches m
     JOIN teams ht ON ht.id = m.home_team_id
     JOIN teams at ON at.id = m.away_team_id
     LEFT JOIN players mvp ON mvp.id = m.result_mvp_player_id
     ORDER BY m.kickoff ASC`
  );

  const predByMatch = {};
  if (userId) for (const p of await db.all('SELECT * FROM predictions WHERE user_id = $1', [userId])) predByMatch[p.match_id] = p;

  const counts = {};
  for (const row of await db.all('SELECT match_id, COUNT(*)::int c FROM predictions GROUP BY match_id')) counts[row.match_id] = row.c;
  const outcomeCounts = {};
  for (const row of await db.all("SELECT match_id, predicted_outcome o, COUNT(*)::int c FROM predictions WHERE predicted_outcome IS NOT NULL GROUP BY match_id, predicted_outcome")) {
    (outcomeCounts[row.match_id] = outcomeCounts[row.match_id] || { home: 0, away: 0, draw: 0 })[row.o] = row.c;
  }
  const votesFor = (mid) => {
    const c = outcomeCounts[mid] || { home: 0, away: 0, draw: 0 };
    const total = c.home + c.away + c.draw;
    const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return { home: c.home, away: c.away, draw: c.draw, total, pct: { home: pct(c.home), away: pct(c.away), draw: pct(c.draw) } };
  };
  const slayerFor = (mid, outcome) => {
    const c = outcomeCounts[mid] || { home: 0, away: 0, draw: 0 };
    const total = c.home + c.away + c.draw, win = c[outcome] || 0;
    if (total === 0 || win === 0) return { points: oddsScale, sharePct: 0, correctCount: 0 };
    const share = win / total;
    return { points: Math.max(1, Math.round((1 - share) * oddsScale)), sharePct: Math.round(share * 100), correctCount: win };
  };

  const out = matches.map((m) => {
    const ls = lockState(m, lockMinutes);
    const p = predByMatch[m.id];
    const isFinished = m.status === 'finished';
    const breakdown = isFinished ? slayerFor(m.id, m.result_outcome) : null;

    let myPrediction = null;
    if (p) {
      myPrediction = { outcome: p.predicted_outcome, mvpPlayerId: p.predicted_mvp_player_id };
      if (isFinished) {
        const outcomeCorrect = !!p.predicted_outcome && p.predicted_outcome === m.result_outcome;
        const mvpCorrect = !!p.predicted_mvp_player_id && p.predicted_mvp_player_id === m.result_mvp_player_id;
        const earnedSlayer = outcomeCorrect ? breakdown.points : 0;
        const earnedMvp = mvpCorrect ? pointsMvp : 0;
        Object.assign(myPrediction, { outcomeCorrect, mvpCorrect, earnedSlayer, earnedMvp, earned: earnedSlayer + earnedMvp });
      }
    }
    return {
      id: m.id, stage: m.stage, kickoff: m.kickoff, lockAt: ls.lockAt, manualLock: m.manual_lock,
      status: m.status, locked: ls.locked, predictionCount: counts[m.id] || 0,
      votes: ls.locked ? votesFor(m.id) : null,
      homeTeam: { id: m.home_team_id, name: m.home_name, code: m.home_code },
      awayTeam: { id: m.away_team_id, name: m.away_name, code: m.away_code },
      players: [], // filled in after the map (async)
      result: isFinished ? {
        outcome: m.result_outcome,
        winnerLabel: m.result_outcome === 'draw' ? 'Draw' : m.result_outcome === 'home' ? m.home_name : m.result_outcome === 'away' ? m.away_name : 'TBD',
        mvpPlayerId: m.result_mvp_player_id, mvpName: m.result_mvp_name,
        slayerPoints: breakdown.points, sharePct: breakdown.sharePct, correctCount: breakdown.correctCount,
      } : null,
      myPrediction,
    };
  });

  // Fill players (needs async) — do it after the synchronous map.
  for (const o of out) {
    o.players = await getMatchPlayers(o.homeTeam.id, o.awayTeam.id);
  }

  res.json({ matches: out, serverTime: new Date().toISOString() });
}));

app.post('/api/predictions', wrap(async (req, res) => {
  const { userId, matchId } = req.body || {};
  const outcome = req.body && req.body.outcome;
  const mvpPlayerId = asInt(req.body && req.body.mvpPlayerId);
  if (!userId || !matchId) return res.status(400).json({ error: 'userId and matchId are required.' });
  if (!(await db.get('SELECT 1 FROM users WHERE id = $1', [userId]))) return res.status(401).json({ error: 'Unknown user. Please join again.' });
  const match = await db.get('SELECT * FROM matches WHERE id = $1', [matchId]);
  if (!match) return res.status(404).json({ error: 'Match not found.' });
  if (match.status === 'finished') return res.status(403).json({ error: 'This match has finished. Predictions are closed.' });
  const lockMinutes = await db.getSettingNumber('lock_minutes', 2);
  if (lockState(match, lockMinutes).locked) return res.status(403).json({ error: 'Predictions are locked for this match.' });

  const outcomeVal = outcome ? String(outcome) : null;
  if (outcomeVal !== null && !['home', 'away', 'draw'].includes(outcomeVal)) return res.status(400).json({ error: 'Winner must be Home, Away, or Draw.' });
  if (mvpPlayerId !== null) {
    const valid = new Set((await getMatchPlayers(match.home_team_id, match.away_team_id)).map((p) => p.id));
    if (!valid.has(mvpPlayerId)) return res.status(400).json({ error: 'MVP must be a player from one of the two teams.' });
  }
  await db.run(
    `INSERT INTO predictions (user_id, match_id, predicted_outcome, predicted_mvp_player_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, match_id) DO UPDATE SET
       predicted_outcome = EXCLUDED.predicted_outcome,
       predicted_mvp_player_id = EXCLUDED.predicted_mvp_player_id,
       updated_at = now()`,
    [userId, matchId, outcomeVal, mvpPlayerId]
  );
  res.json({ ok: true });
}));

app.get('/api/leaderboards', wrap(async (req, res) => res.json(await computeLeaderboards())));
app.get('/api/users/:id/stats', wrap(async (req, res) => res.json(await userStanding(req.params.id))));

/* ------------------------------- Leagues -------------------------------- */
async function requireUser(idAndToken) {
  const { userId, token } = idAndToken || {};
  if (userId && token && verifyUserToken(userId, token)) return db.get('SELECT * FROM users WHERE id = $1', [userId]);
  return null;
}
function genLeagueCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) code += alphabet[bytes[i] % alphabet.length];
  return code;
}

app.post('/api/leagues', wrap(async (req, res) => {
  const user = await requireUser(req.body);
  if (!user) return res.status(401).json({ error: 'Please log in to create a league.' });
  const name = (req.body.name || '').trim().slice(0, 40);
  if (name.length < 2) return res.status(400).json({ error: 'League name must be at least 2 characters.' });
  let code = genLeagueCode();
  for (let i = 0; i < 5 && (await db.get('SELECT 1 FROM leagues WHERE code = $1', [code])); i++) code = genLeagueCode();
  const row = (await db.run('INSERT INTO leagues (code, name, owner_id) VALUES ($1, $2, $3) RETURNING id', [code, name, user.id])).rows[0];
  await db.run('INSERT INTO league_members (league_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [row.id, user.id]);
  res.json({ id: row.id, code, name });
}));

app.post('/api/leagues/join', wrap(async (req, res) => {
  const user = await requireUser(req.body);
  if (!user) return res.status(401).json({ error: 'Please log in to join a league.' });
  const code = (req.body.code || '').trim().toUpperCase();
  const league = await db.get('SELECT * FROM leagues WHERE code = $1', [code]);
  if (!league) return res.status(404).json({ error: 'No league found with that code.' });
  await db.run('INSERT INTO league_members (league_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [league.id, user.id]);
  res.json({ id: league.id, code: league.code, name: league.name });
}));

app.get('/api/leagues/mine', wrap(async (req, res) => {
  const user = await requireUser({ userId: req.query.userId, token: req.query.token });
  if (!user) return res.status(401).json({ error: 'Please log in.' });
  const leagues = await db.all(
    `SELECT l.id, l.code, l.name, l.owner_id,
            (SELECT COUNT(*)::int FROM league_members lm2 WHERE lm2.league_id = l.id) AS "memberCount"
     FROM leagues l JOIN league_members lm ON lm.league_id = l.id
     WHERE lm.user_id = $1 ORDER BY l.created_at DESC`, [user.id]
  );
  res.json({ leagues });
}));

app.get('/api/leagues/:code/leaderboard', wrap(async (req, res) => {
  const user = await requireUser({ userId: req.query.userId, token: req.query.token });
  if (!user) return res.status(401).json({ error: 'Please log in.' });
  const league = await db.get('SELECT * FROM leagues WHERE code = $1', [(req.params.code || '').toUpperCase()]);
  if (!league) return res.status(404).json({ error: 'League not found.' });
  const members = (await db.all('SELECT user_id FROM league_members WHERE league_id = $1', [league.id])).map((r) => r.user_id);
  if (!members.includes(user.id)) return res.status(403).json({ error: 'You are not a member of this league.' });
  const boards = await leagueBoards(members);
  res.json({ league: { id: league.id, code: league.code, name: league.name, memberCount: members.length }, ...boards });
}));

/* ============================== ADMIN API ================================= */

const loginAttempts = new Map();
const MAX_ATTEMPTS = 6, WINDOW_MS = 10 * 60 * 1000, BLOCK_MS = 15 * 60 * 1000;
function loginRateLimit(req, res, next) {
  const ip = req.ip || 'unknown', now = Date.now();
  const rec = loginAttempts.get(ip);
  if (rec && rec.blockedUntil && now < rec.blockedUntil) {
    return res.status(429).json({ error: `Too many attempts. Try again in ~${Math.ceil((rec.blockedUntil - now) / 60000)} min.` });
  }
  next();
}
function recordFailure(ip) {
  const now = Date.now();
  let rec = loginAttempts.get(ip);
  if (!rec || now - rec.firstAt > WINDOW_MS) rec = { count: 0, firstAt: now, blockedUntil: 0 };
  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) rec.blockedUntil = now + BLOCK_MS;
  loginAttempts.set(ip, rec);
}

app.post('/api/admin/login', loginRateLimit, (req, res) => {
  const { password } = req.body || {};
  if (!password || !safeEqual(password, ADMIN_PASSWORD)) { recordFailure(req.ip || 'unknown'); return res.status(401).json({ error: 'Incorrect password.' }); }
  loginAttempts.delete(req.ip || 'unknown');
  res.cookie('ff_admin', adminToken(), { httpOnly: true, sameSite: 'lax', secure: IS_PROD, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => { res.clearCookie('ff_admin'); res.json({ ok: true }); });
app.get('/api/admin/me', (req, res) => res.json({ admin: isAdmin(req) }));

app.get('/api/admin/stats', requireAdmin, wrap(async (req, res) => {
  const lockMinutes = await db.getSettingNumber('lock_minutes', 2);
  const one = async (sql) => (await db.get(sql)).c;
  const upcoming = (await db.all(
    `SELECT m.*, ht.name AS home_name, at.name AS away_name
     FROM matches m JOIN teams ht ON ht.id=m.home_team_id JOIN teams at ON at.id=m.away_team_id
     WHERE m.status <> 'finished' ORDER BY m.kickoff ASC LIMIT 5`
  )).map((m) => ({ id: m.id, label: `${m.home_name} vs ${m.away_name}`, kickoff: m.kickoff, locked: lockState(m, lockMinutes).locked, manualLock: m.manual_lock }));
  res.json({
    teams: await one('SELECT COUNT(*)::int c FROM teams'),
    players: await one('SELECT COUNT(*)::int c FROM players'),
    matches: await one('SELECT COUNT(*)::int c FROM matches'),
    finishedMatches: await one("SELECT COUNT(*)::int c FROM matches WHERE status='finished'"),
    users: await one('SELECT COUNT(*)::int c FROM users'),
    predictions: await one('SELECT COUNT(*)::int c FROM predictions'),
    upcoming,
  });
}));

app.get('/api/admin/users', requireAdmin, wrap(async (req, res) => {
  const users = await db.all(
    `SELECT u.id, u.username, u.insta_url, u.created_at,
            t.name AS fan_team_name, t.code AS fan_team_code,
            (SELECT COUNT(*)::int FROM predictions p WHERE p.user_id = u.id) AS predictions
     FROM users u LEFT JOIN teams t ON t.id = u.fan_team_id
     ORDER BY u.created_at DESC`
  );
  res.json({ users });
}));

/* ----- Teams ----- */
app.get('/api/admin/teams', requireAdmin, wrap(async (req, res) => {
  res.json({ teams: await db.all('SELECT * FROM teams ORDER BY confederation, name') });
}));
app.post('/api/admin/teams', requireAdmin, wrap(async (req, res) => {
  const name = (req.body.name || '').trim(), code = (req.body.code || '').trim(), conf = (req.body.confederation || '').trim();
  if (!name) return res.status(400).json({ error: 'Team name is required.' });
  const row = (await db.run('INSERT INTO teams (name, code, confederation) VALUES ($1,$2,$3) RETURNING id', [name, code, conf])).rows[0];
  invalidate(); res.json({ id: row.id });
}));
app.put('/api/admin/teams/:id', requireAdmin, wrap(async (req, res) => {
  const name = (req.body.name || '').trim(), code = (req.body.code || '').trim(), conf = (req.body.confederation || '').trim();
  if (!name) return res.status(400).json({ error: 'Team name is required.' });
  await db.run('UPDATE teams SET name=$1, code=$2, confederation=$3 WHERE id=$4', [name, code, conf, req.params.id]);
  invalidate(); res.json({ ok: true });
}));
app.delete('/api/admin/teams/:id', requireAdmin, wrap(async (req, res) => {
  await db.run('DELETE FROM teams WHERE id = $1', [req.params.id]); invalidate(); res.json({ ok: true });
}));

/* ----- Players ----- */
app.get('/api/admin/players', requireAdmin, wrap(async (req, res) => {
  res.json({ players: await db.all(`SELECT p.*, t.name AS team_name FROM players p JOIN teams t ON t.id = p.team_id ORDER BY t.name, p.name`) });
}));
app.post('/api/admin/players', requireAdmin, wrap(async (req, res) => {
  const name = (req.body.name || '').trim(), teamId = asInt(req.body.teamId);
  if (!name || !teamId) return res.status(400).json({ error: 'Player name and team are required.' });
  const row = (await db.run('INSERT INTO players (name, team_id) VALUES ($1,$2) RETURNING id', [name, teamId])).rows[0];
  res.json({ id: row.id });
}));
app.put('/api/admin/players/:id', requireAdmin, wrap(async (req, res) => {
  const name = (req.body.name || '').trim(), teamId = asInt(req.body.teamId);
  if (!name || !teamId) return res.status(400).json({ error: 'Player name and team are required.' });
  await db.run('UPDATE players SET name=$1, team_id=$2 WHERE id=$3', [name, teamId, req.params.id]); res.json({ ok: true });
}));
app.delete('/api/admin/players/:id', requireAdmin, wrap(async (req, res) => {
  await db.run('DELETE FROM players WHERE id = $1', [req.params.id]); res.json({ ok: true });
}));

/* ----- Matches ----- */
app.get('/api/admin/matches', requireAdmin, wrap(async (req, res) => {
  const lockMinutes = await db.getSettingNumber('lock_minutes', 2);
  const rows = await db.all(
    `SELECT m.*, ht.name AS home_name, at.name AS away_name
     FROM matches m JOIN teams ht ON ht.id=m.home_team_id JOIN teams at ON at.id=m.away_team_id
     ORDER BY m.kickoff ASC`
  );
  res.json({ matches: rows.map((m) => ({ ...m, locked: lockState(m, lockMinutes).locked, effectiveLockAt: lockState(m, lockMinutes).lockAt })) });
}));
function validateMatchBody(body) {
  const homeTeamId = asInt(body.homeTeamId), awayTeamId = asInt(body.awayTeamId);
  const kickoff = (body.kickoff || '').trim();
  if (!homeTeamId || !awayTeamId || !kickoff) return { error: 'Home team, away team, and kickoff are required.' };
  if (homeTeamId === awayTeamId) return { error: 'A team cannot play itself.' };
  if (!Number.isFinite(new Date(kickoff).getTime())) return { error: 'Kickoff must be a valid date/time.' };
  const lockAtRaw = (body.lockAt || '').trim();
  if (lockAtRaw && !Number.isFinite(new Date(lockAtRaw).getTime())) return { error: 'Lock time must be a valid date/time.' };
  const manualLock = ['auto', 'locked', 'open'].includes(body.manualLock) ? body.manualLock : 'auto';
  return { homeTeamId, awayTeamId, kickoff, stage: (body.stage || '').trim(), lockAt: lockAtRaw || null, manualLock };
}
app.post('/api/admin/matches', requireAdmin, wrap(async (req, res) => {
  const v = validateMatchBody(req.body || {});
  if (v.error) return res.status(400).json({ error: v.error });
  const row = (await db.run('INSERT INTO matches (home_team_id, away_team_id, kickoff, stage, lock_at, manual_lock) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [v.homeTeamId, v.awayTeamId, v.kickoff, v.stage, v.lockAt, v.manualLock])).rows[0];
  invalidate(); res.json({ id: row.id });
}));
app.put('/api/admin/matches/:id', requireAdmin, wrap(async (req, res) => {
  const v = validateMatchBody(req.body || {});
  if (v.error) return res.status(400).json({ error: v.error });
  await db.run('UPDATE matches SET home_team_id=$1, away_team_id=$2, kickoff=$3, stage=$4, lock_at=$5, manual_lock=$6 WHERE id=$7',
    [v.homeTeamId, v.awayTeamId, v.kickoff, v.stage, v.lockAt, v.manualLock, req.params.id]);
  invalidate(); res.json({ ok: true });
}));
app.delete('/api/admin/matches/:id', requireAdmin, wrap(async (req, res) => {
  await db.run('DELETE FROM matches WHERE id = $1', [req.params.id]); invalidate(); res.json({ ok: true });
}));
app.post('/api/admin/matches/:id/lock', requireAdmin, wrap(async (req, res) => {
  const mode = req.body && req.body.mode;
  if (!['auto', 'locked', 'open'].includes(mode)) return res.status(400).json({ error: "mode must be 'auto', 'locked', or 'open'." });
  const r = await db.run('UPDATE matches SET manual_lock=$1 WHERE id=$2', [mode, req.params.id]);
  if (!r.rowCount) return res.status(404).json({ error: 'Match not found.' });
  res.json({ ok: true, mode });
}));
app.post('/api/admin/matches/:id/result', requireAdmin, wrap(async (req, res) => {
  const match = await db.get('SELECT * FROM matches WHERE id = $1', [req.params.id]);
  if (!match) return res.status(404).json({ error: 'Match not found.' });
  const finished = req.body.finished !== false;
  const outcome = req.body.outcome ? String(req.body.outcome) : null;
  const mvpPlayerId = asInt(req.body.mvpPlayerId);
  if (finished) {
    if (outcome !== null && !['home', 'away', 'draw'].includes(outcome)) return res.status(400).json({ error: 'Outcome must be Home, Away, or Draw.' });
    const winnerTeamId = outcome === 'home' ? match.home_team_id : outcome === 'away' ? match.away_team_id : null;
    await db.run(`UPDATE matches SET status='finished', result_outcome=$1, result_winner_team_id=$2, result_mvp_player_id=$3 WHERE id=$4`,
      [outcome, winnerTeamId, mvpPlayerId, req.params.id]);
  } else {
    await db.run(`UPDATE matches SET status='scheduled', result_outcome=NULL, result_winner_team_id=NULL, result_mvp_player_id=NULL WHERE id=$1`, [req.params.id]);
  }
  invalidate(); res.json({ ok: true });
}));

/* ----- Settings ----- */
app.get('/api/admin/settings', requireAdmin, wrap(async (req, res) => res.json({ settings: await db.getAllSettings() })));
app.put('/api/admin/settings', requireAdmin, wrap(async (req, res) => {
  const allowed = [
    'points_winner', 'points_mvp', 'odds_scale', 'leaderboard_size', 'lock_minutes', 'min_predictions',
    'site_title', 'site_tagline', 'disclaimer', 'titles',
    'promo_enabled', 'promo_type', 'promo_title', 'promo_text', 'promo_image_url', 'promo_insta', 'promo_link',
  ];
  const incoming = req.body || {};
  if (Object.prototype.hasOwnProperty.call(incoming, 'titles') && incoming.titles) {
    try { if (!Array.isArray(JSON.parse(incoming.titles))) throw new Error('x'); }
    catch { return res.status(400).json({ error: 'Titles must be valid JSON array of {min, name, emoji}.' }); }
  }
  for (const key of allowed) if (Object.prototype.hasOwnProperty.call(incoming, key)) await db.setSetting(key, incoming[key]);
  invalidate();
  res.json({ ok: true, settings: await db.getAllSettings() });
}));

/* ------------------------------ HTML routes ------------------------------- */
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralised error handler.
app.use((err, req, res, next) => {
  console.error('Request error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Server error.' });
});

(async () => {
  try {
    await db.init();
    app.listen(PORT, () => {
      console.log(`\n  ⚽ Fun Football running:  http://localhost:${PORT}`);
      console.log(`     Admin panel:           http://localhost:${PORT}/admin\n`);
    });
  } catch (e) {
    console.error('Failed to start (database init error):', e.message);
    process.exit(1);
  }
})();
