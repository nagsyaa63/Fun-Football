/**
 * scoring.js (Postgres / async)
 * -----------------------------
 * Ratio-based "Giant Slayer" scoring, leaderboards, titles, league boards, and
 * the "Giant Slayer of the day" spotlight. All functions are async (the data
 * layer is Postgres). computeAll() is cached in-memory for a few seconds and
 * invalidated immediately on result/setting changes (see invalidate()).
 */

'use strict';

const db = require('./db');

const CACHE_TTL_MS = 10 * 1000;
let _cache = null; // { at, data }

const DEFAULT_TITLES = [
  { min: 0, name: 'Debutant', emoji: '🆕' },
  { min: 40, name: 'Squad Player', emoji: '🧤' },
  { min: 100, name: 'First XI', emoji: '👕' },
  { min: 200, name: 'Playmaker', emoji: '🎯' },
  { min: 350, name: 'Star Striker', emoji: '🔥' },
  { min: 550, name: 'Captain', emoji: '🅒' },
  { min: 800, name: 'Maestro', emoji: '🏅' },
  { min: 1100, name: 'Legend', emoji: '👑' },
  { min: 1450, name: 'GOAT', emoji: '🐐' },
];

async function getTitles() {
  const raw = await db.getSetting('titles');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.filter((t) => typeof t.min === 'number' && t.name).sort((a, b) => a.min - b.min);
      }
    } catch { /* fall through */ }
  }
  return DEFAULT_TITLES;
}
function titleForPoints(points, titles) {
  let current = titles[0];
  for (const t of titles) if (points >= t.min) current = t;
  return current;
}
function nextTitle(points, titles) {
  for (const t of titles) if (points < t.min) return { ...t, pointsAway: t.min - points };
  return null;
}

/** Per finished match: winner vote share, total votes, and correct-pick points. */
async function matchWinnerInfo(scale) {
  const finished = await db.all(
    "SELECT id, result_outcome FROM matches WHERE status='finished' AND result_outcome IS NOT NULL"
  );
  const voteRows = await db.all(
    `SELECT p.match_id, p.predicted_outcome AS o, COUNT(*)::int AS c
     FROM predictions p JOIN matches m ON m.id = p.match_id AND m.status='finished'
     WHERE p.predicted_outcome IS NOT NULL
     GROUP BY p.match_id, p.predicted_outcome`
  );
  const totals = {}, winVotes = {}, resultByMatch = {};
  for (const m of finished) resultByMatch[m.id] = m.result_outcome;
  for (const r of voteRows) {
    totals[r.match_id] = (totals[r.match_id] || 0) + r.c;
    if (resultByMatch[r.match_id] === r.o) winVotes[r.match_id] = r.c;
  }
  const info = {};
  for (const m of finished) {
    const total = totals[m.id] || 0;
    const win = winVotes[m.id] || 0;
    const share = total > 0 && win > 0 ? win / total : 0;
    const points = total > 0 && win > 0 ? Math.max(1, Math.round((1 - share) * scale)) : scale;
    info[m.id] = { points, share, total, win, outcome: m.result_outcome };
  }
  return info;
}

async function buildAll() {
  const scale = await db.getSettingNumber('odds_scale', 10);
  const mp = await db.getSettingNumber('points_mvp', 5);
  const minPredictions = await db.getSettingNumber('min_predictions', 5);
  const leaderboardSize = await db.getSettingNumber('leaderboard_size', 100);
  const titles = await getTitles();
  const winInfo = await matchWinnerInfo(scale);

  const rows = await db.all(
    `SELECT p.user_id, u.username, u.fan_team_id, ft.name AS fan_name, ft.code AS fan_code,
            p.match_id, p.predicted_outcome, p.predicted_mvp_player_id,
            m.result_outcome, m.result_mvp_player_id
     FROM predictions p
     JOIN users u   ON u.id = p.user_id
     JOIN matches m ON m.id = p.match_id AND m.status='finished'
     LEFT JOIN teams ft ON ft.id = u.fan_team_id`
  );

  const byUser = new Map();
  for (const r of rows) {
    let u = byUser.get(r.user_id);
    if (!u) {
      u = { userId: r.user_id, username: r.username, fanTeamName: r.fan_name || null, fanTeamCode: r.fan_code || null,
            matchesAttempted: 0, winnerHits: 0, mvpHits: 0, slayerPoints: 0, mvpPoints: 0 };
      byUser.set(r.user_id, u);
    }
    u.matchesAttempted += 1;
    if (r.predicted_outcome && r.predicted_outcome === r.result_outcome) {
      u.winnerHits += 1;
      u.slayerPoints += (winInfo[r.match_id] || {}).points || 0;
    }
    if (r.predicted_mvp_player_id && r.predicted_mvp_player_id === r.result_mvp_player_id) {
      u.mvpHits += 1;
      u.mvpPoints += mp;
    }
  }

  const entries = [...byUser.values()].map((u) => {
    const totalPoints = u.slayerPoints + u.mvpPoints;
    const t = titleForPoints(totalPoints, titles);
    return {
      ...u, totalPoints,
      averagePoints: u.matchesAttempted > 0 ? totalPoints / u.matchesAttempted : 0,
      accuracy: u.matchesAttempted > 0 ? Math.round(((u.winnerHits + u.mvpHits) / (u.matchesAttempted * 2)) * 100) : 0,
      title: t.name, titleEmoji: t.emoji,
    };
  });

  const rank = (arr) => arr.map((e, i) => ({ rank: i + 1, ...e }));
  const overall = rank([...entries].sort((a, b) => b.totalPoints - a.totalPoints || b.slayerPoints - a.slayerPoints || b.matchesAttempted - a.matchesAttempted));
  const slayer = rank([...entries].sort((a, b) => b.slayerPoints - a.slayerPoints || b.winnerHits - a.winnerHits));
  const mvp = rank([...entries].sort((a, b) => b.mvpPoints - a.mvpPoints || b.mvpHits - a.mvpHits));
  const average = rank(entries.filter((e) => e.matchesAttempted >= minPredictions)
    .sort((a, b) => b.averagePoints - a.averagePoints || b.matchesAttempted - a.matchesAttempted)
    .map((e) => ({ ...e, averagePoints: Math.round(e.averagePoints * 100) / 100 })));

  // Spotlight: biggest upset someone nailed (lowest winning vote share).
  let spotlight = null;
  const finishedMatches = await db.all(
    `SELECT m.id, m.result_outcome, ht.name AS home, at.name AS away
     FROM matches m JOIN teams ht ON ht.id=m.home_team_id JOIN teams at ON at.id=m.away_team_id
     WHERE m.status='finished' AND m.result_outcome IS NOT NULL`
  );
  let best = null;
  for (const m of finishedMatches) {
    const wi = winInfo[m.id];
    if (!wi || wi.total === 0 || wi.win === 0) continue;
    if (!best || wi.share < best.share) best = { ...wi, home: m.home, away: m.away, label: `${m.home} vs ${m.away}` };
  }
  if (best) {
    const outcomeLabel = best.outcome === 'draw' ? 'a Draw' : best.outcome === 'home' ? `${best.home} to win` : `${best.away} to win`;
    spotlight = { label: best.label, outcomeLabel, sharePct: Math.round(best.share * 100), points: best.points, correctCount: best.win, total: best.total };
  }

  return {
    config: { oddsScale: scale, pointsMvp: mp, minPredictions, leaderboardSize },
    titles,
    boards: { overall, slayer, mvp, average },
    spotlight,
    generatedAt: new Date().toISOString(),
  };
}

async function computeAll() {
  const now = Date.now();
  if (_cache && now - _cache.at < CACHE_TTL_MS) return _cache.data;
  const data = await buildAll();
  _cache = { at: now, data };
  return data;
}
function invalidate() { _cache = null; }

async function computeLeaderboards() {
  const all = await computeAll();
  const n = all.config.leaderboardSize || 100;
  const sliced = {};
  for (const [k, arr] of Object.entries(all.boards)) sliced[k] = arr.slice(0, n);
  return { config: all.config, titles: all.titles, boards: sliced, spotlight: all.spotlight, generatedAt: all.generatedAt };
}

async function leagueBoards(memberIds) {
  const all = await computeAll();
  const set = new Set(memberIds);
  const strip = (e) => { const { rank, ...rest } = e; return rest; };
  const rank = (arr) => arr.filter((e) => set.has(e.userId)).map((e, i) => ({ rank: i + 1, ...strip(e) }));
  return {
    config: all.config,
    boards: { overall: rank(all.boards.overall), slayer: rank(all.boards.slayer), mvp: rank(all.boards.mvp), average: rank(all.boards.average) },
    generatedAt: all.generatedAt,
  };
}

async function userStanding(userId) {
  const all = await computeAll();
  const find = (board) => all.boards[board].find((x) => x.userId === userId) || null;
  const overall = find('overall');
  const totalPoints = overall ? overall.totalPoints : 0;
  const t = titleForPoints(totalPoints, all.titles);
  const pick = (e, key) => (e ? { points: e[key], rank: e.rank } : { points: 0, rank: null });
  return {
    found: !!overall, userId,
    username: overall ? overall.username : null,
    fanTeamName: overall ? overall.fanTeamName : null,
    fanTeamCode: overall ? overall.fanTeamCode : null,
    matchesAttempted: overall ? overall.matchesAttempted : 0,
    accuracy: overall ? overall.accuracy : 0,
    totalPoints, title: t.name, titleEmoji: t.emoji,
    next: nextTitle(totalPoints, all.titles),
    boards: {
      overall: pick(overall, 'totalPoints'),
      slayer: pick(find('slayer'), 'slayerPoints'),
      mvp: pick(find('mvp'), 'mvpPoints'),
      average: (() => { const e = find('average'); return e ? { points: e.averagePoints, rank: e.rank } : { points: 0, rank: null }; })(),
    },
    totalPlayers: all.boards.overall.length,
    generatedAt: all.generatedAt,
  };
}

module.exports = { computeLeaderboards, leagueBoards, userStanding, invalidate, getTitles, DEFAULT_TITLES };
