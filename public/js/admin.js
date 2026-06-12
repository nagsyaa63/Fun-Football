/* ===========================================================================
   Fun Football - admin.js (v2)
   Dashboard + CRUD for teams, players, matches (with lock time + manual lock
   override), results (winner + MVP), and promo/settings (incl. disclaimer +
   titles). All admin endpoints use the httpOnly ff_admin cookie.
   =========================================================================== */

(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const cache = { teams: [], players: [], matches: [], users: [] };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  async function api(path, opts = {}) {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }
  let toastTimer;
  function toast(msg, type = '') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = 'toast'), 2600);
  }
  function isoToLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const localInputToIso = (val) => (val ? new Date(val).toISOString() : null);
  function fmt(iso) { const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.toLocaleString() : '—'; }

  /* ----------------------------- Theme ----------------------------- */
  function applyThemeIcon() {
    const t = document.documentElement.getAttribute('data-theme') || 'dark';
    const btn = $('#themeToggle');
    if (btn) btn.textContent = t === 'light' ? '☀️' : '🌙';
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = cur === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('ff_theme', next); } catch { /* ignore */ }
    applyThemeIcon();
  }

  /* ----------------------------- Auth ----------------------------- */
  async function checkAuth() {
    const { admin } = await api('/api/admin/me');
    admin ? showAdmin() : showLogin();
  }
  function showLogin() {
    $('#loginView').classList.remove('hidden');
    $('#adminView').classList.add('hidden');
    $('#logoutBtn').classList.add('hidden');
  }
  async function showAdmin() {
    $('#loginView').classList.add('hidden');
    $('#adminView').classList.remove('hidden');
    $('#logoutBtn').classList.remove('hidden');
    await refreshAll();
  }
  async function login() {
    $('#loginError').textContent = '';
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: $('#adminPassword').value }) });
      $('#adminPassword').value = '';
      showAdmin();
    } catch (e) { $('#loginError').textContent = e.message; }
  }
  async function logout() { await api('/api/admin/logout', { method: 'POST' }); showLogin(); }

  /* ----------------------------- Load ----------------------------- */
  async function refreshAll() {
    const [t, p, m, s, stats, u] = await Promise.all([
      api('/api/admin/teams'), api('/api/admin/players'), api('/api/admin/matches'),
      api('/api/admin/settings'), api('/api/admin/stats'), api('/api/admin/users'),
    ]);
    cache.teams = t.teams; cache.players = p.players; cache.matches = m.matches; cache.users = u.users;
    fillTeamSelects();
    renderDashboard(stats);
    renderTeams(); renderPlayers(); renderMatches(); renderResults(); renderUsers();
    fillSettings(s.settings);
  }

  function teamLabel(id) {
    const t = cache.teams.find((x) => x.id === id);
    return t ? `${t.code || ''} ${t.name}`.trim() : '—';
  }

  /* ----------------------------- Dashboard ----------------------------- */
  function renderDashboard(stats) {
    $('#statCards').innerHTML = `
      <div class="stat"><b>${stats.users}</b><span>Players</span></div>
      <div class="stat"><b>${stats.predictions}</b><span>Predictions</span></div>
      <div class="stat"><b>${stats.teams}</b><span>Teams</span></div>
      <div class="stat"><b>${stats.players}</b><span>Squad players</span></div>
      <div class="stat"><b>${stats.matches}</b><span>Matches</span></div>
      <div class="stat"><b>${stats.finishedMatches}</b><span>Finished</span></div>`;
    const up = stats.upcoming || [];
    $('#upcomingList').innerHTML = up.length
      ? up.map((m) => `<div class="list-item">
          <div><strong>#${m.id} · ${esc(m.label)}</strong><div class="meta">${fmt(m.kickoff)}</div></div>
          <div>${m.locked ? '<span class="status-tag status-locked">Locked</span>' : '<span class="status-tag status-open">Open</span>'}
            <span class="meta">override: ${esc(m.manualLock)}</span></div>
        </div>`).join('')
      : '<p class="empty">No upcoming matches.</p>';
  }

  /* ----------------------------- Users ----------------------------- */
  function instaLink(raw) {
    if (!raw) return '<span class="muted">—</span>';
    const url = /^https?:\/\//i.test(raw) ? raw : 'https://instagram.com/' + raw.replace(/^@/, '');
    return `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(raw)}</a>`;
  }
  function renderUsers() {
    const el = $('#userList');
    if (!cache.users.length) { el.innerHTML = '<p class="empty">No users yet.</p>'; return; }
    el.innerHTML = `<table>
      <thead><tr><th>Username</th><th>ID</th><th>Fan of</th><th>Instagram 🔒</th><th class="num">Preds</th><th>Joined</th></tr></thead>
      <tbody>${cache.users.map((u) => `<tr>
        <td><strong>${esc(u.username)}</strong></td>
        <td class="muted">${esc(u.id)}</td>
        <td>${esc(u.fan_team_code || '')} ${esc(u.fan_team_name || '')}</td>
        <td>${instaLink(u.insta_url)}</td>
        <td class="num">${u.predictions}</td>
        <td class="muted">${fmt(u.created_at)}</td>
      </tr>`).join('')}</tbody></table>`;
  }

  /* ----------------------------- Teams ----------------------------- */
  function renderTeams() {
    const el = $('#teamList');
    el.innerHTML = cache.teams.length ? cache.teams.map((t) => `<div class="list-item">
        <div><strong>${esc(t.code || '')} ${esc(t.name)}</strong> <span class="meta">${esc(t.confederation || '')}</span></div>
        <div><button class="btn btn-sm" data-edit-team="${t.id}">Edit</button>
             <button class="btn btn-sm btn-danger" data-del-team="${t.id}">Delete</button></div>
      </div>`).join('') : '<p class="empty">No teams yet.</p>';
    $$('[data-edit-team]', el).forEach((b) => b.addEventListener('click', () => editTeam(Number(b.dataset.editTeam))));
    $$('[data-del-team]', el).forEach((b) => b.addEventListener('click', () => delTeam(Number(b.dataset.delTeam))));
  }
  function editTeam(id) {
    const t = cache.teams.find((x) => x.id === id); if (!t) return;
    $('#teamId').value = t.id; $('#teamName').value = t.name; $('#teamCode').value = t.code || '';
    $('#teamConf').value = t.confederation || ''; $('#cancelTeamEdit').classList.remove('hidden');
  }
  function resetTeamForm() {
    $('#teamId').value = ''; $('#teamName').value = ''; $('#teamCode').value = ''; $('#teamConf').value = '';
    $('#cancelTeamEdit').classList.add('hidden');
  }
  async function saveTeam() {
    const id = $('#teamId').value;
    const body = JSON.stringify({ name: $('#teamName').value, code: $('#teamCode').value, confederation: $('#teamConf').value });
    try {
      if (id) await api(`/api/admin/teams/${id}`, { method: 'PUT', body });
      else await api('/api/admin/teams', { method: 'POST', body });
      resetTeamForm(); await refreshAll(); toast('Team saved.', 'success');
    } catch (e) { toast(e.message, 'error'); }
  }
  async function delTeam(id) {
    if (!confirm('Delete this team? Its players and matches involving it will also be removed.')) return;
    try { await api(`/api/admin/teams/${id}`, { method: 'DELETE' }); await refreshAll(); toast('Team deleted.', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  }

  /* ----------------------------- Players ----------------------------- */
  function renderPlayers() {
    const el = $('#playerList');
    el.innerHTML = cache.players.length ? cache.players.map((p) => `<div class="list-item">
        <div><strong>${esc(p.name)}</strong> <span class="meta">— ${esc(p.team_name)}</span></div>
        <div><button class="btn btn-sm" data-edit-player="${p.id}">Edit</button>
             <button class="btn btn-sm btn-danger" data-del-player="${p.id}">Delete</button></div>
      </div>`).join('') : '<p class="empty">No players yet.</p>';
    $$('[data-edit-player]', el).forEach((b) => b.addEventListener('click', () => editPlayer(Number(b.dataset.editPlayer))));
    $$('[data-del-player]', el).forEach((b) => b.addEventListener('click', () => delPlayer(Number(b.dataset.delPlayer))));
  }
  function editPlayer(id) {
    const p = cache.players.find((x) => x.id === id); if (!p) return;
    $('#playerId').value = p.id; $('#playerName').value = p.name; $('#playerTeam').value = p.team_id;
    $('#cancelPlayerEdit').classList.remove('hidden');
  }
  function resetPlayerForm() { $('#playerId').value = ''; $('#playerName').value = ''; $('#cancelPlayerEdit').classList.add('hidden'); }
  async function savePlayer() {
    const id = $('#playerId').value;
    const body = JSON.stringify({ name: $('#playerName').value, teamId: $('#playerTeam').value });
    try {
      if (id) await api(`/api/admin/players/${id}`, { method: 'PUT', body });
      else await api('/api/admin/players', { method: 'POST', body });
      resetPlayerForm(); await refreshAll(); toast('Player saved.', 'success');
    } catch (e) { toast(e.message, 'error'); }
  }
  async function delPlayer(id) {
    if (!confirm('Delete this player?')) return;
    try { await api(`/api/admin/players/${id}`, { method: 'DELETE' }); await refreshAll(); toast('Player deleted.', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  }

  /* ----------------------------- Matches ----------------------------- */
  function fillTeamSelects() {
    const opts = cache.teams.map((t) => `<option value="${t.id}">${esc(t.code || '')} ${esc(t.name)}</option>`).join('');
    $('#matchHome').innerHTML = opts;
    $('#matchAway').innerHTML = opts;
    $('#playerTeam').innerHTML = opts || '<option value="">— add a team first —</option>';
  }
  function renderMatches() {
    const el = $('#matchList');
    el.innerHTML = cache.matches.length ? cache.matches.map((m) => {
      const fin = m.status === 'finished' ? ' · <span class="meta">finished</span>' : '';
      const lockTag = m.locked ? '<span class="status-tag status-locked">Locked</span>' : '<span class="status-tag status-open">Open</span>';
      return `<div class="list-item">
        <div><strong>#${m.id} · ${esc(m.home_name)} vs ${esc(m.away_name)}</strong>
          <div class="meta">${esc(m.stage || '')} · KO ${fmt(m.kickoff)} · lock ${fmt(m.effectiveLockAt)} · override: ${esc(m.manual_lock)}${fin}</div></div>
        <div>${lockTag}
          <button class="btn btn-sm" data-edit-match="${m.id}">Edit</button>
          <button class="btn btn-sm btn-danger" data-del-match="${m.id}">Delete</button></div>
      </div>`;
    }).join('') : '<p class="empty">No matches yet.</p>';
    $$('[data-edit-match]', el).forEach((b) => b.addEventListener('click', () => editMatch(Number(b.dataset.editMatch))));
    $$('[data-del-match]', el).forEach((b) => b.addEventListener('click', () => delMatch(Number(b.dataset.delMatch))));
  }
  function editMatch(id) {
    const m = cache.matches.find((x) => x.id === id); if (!m) return;
    $('#matchId').value = m.id;
    $('#matchHome').value = m.home_team_id;
    $('#matchAway').value = m.away_team_id;
    $('#matchKickoff').value = isoToLocalInput(m.kickoff);
    $('#matchLockAt').value = isoToLocalInput(m.lock_at);
    $('#matchStage').value = m.stage || '';
    $('#matchManualLock').value = m.manual_lock || 'auto';
    $('#cancelMatchEdit').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function resetMatchForm() {
    $('#matchId').value = ''; $('#matchKickoff').value = ''; $('#matchLockAt').value = '';
    $('#matchStage').value = ''; $('#matchManualLock').value = 'auto'; $('#cancelMatchEdit').classList.add('hidden');
  }
  async function saveMatch() {
    const id = $('#matchId').value;
    const kickoffVal = $('#matchKickoff').value;
    if (!kickoffVal) return toast('Please choose a kickoff time.', 'error');
    const body = JSON.stringify({
      homeTeamId: $('#matchHome').value,
      awayTeamId: $('#matchAway').value,
      kickoff: localInputToIso(kickoffVal),
      lockAt: localInputToIso($('#matchLockAt').value),
      manualLock: $('#matchManualLock').value,
      stage: $('#matchStage').value,
    });
    try {
      if (id) await api(`/api/admin/matches/${id}`, { method: 'PUT', body });
      else await api('/api/admin/matches', { method: 'POST', body });
      resetMatchForm(); await refreshAll(); toast('Match saved.', 'success');
    } catch (e) { toast(e.message, 'error'); }
  }
  async function delMatch(id) {
    if (!confirm('Delete this match? All predictions for it will be removed.')) return;
    try { await api(`/api/admin/matches/${id}`, { method: 'DELETE' }); await refreshAll(); toast('Match deleted.', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  }

  /* ----------------------------- Results & lock ----------------------------- */
  function renderResults() {
    const el = $('#resultList');
    if (!cache.matches.length) { el.innerHTML = '<p class="empty">No matches yet.</p>'; return; }
    el.innerHTML = cache.matches.map((m) => {
      const players = cache.players.filter((p) => p.team_id === m.home_team_id || p.team_id === m.away_team_id);
      const outcomeOpts = (sel) => [
        { v: 'home', label: `${m.home_name} win` },
        { v: 'draw', label: 'Draw' },
        { v: 'away', label: `${m.away_name} win` },
      ].map((o) => `<option value="${o.v}" ${sel === o.v ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
      const playerOpts = (sel) => players
        .map((p) => `<option value="${p.id}" ${sel === p.id ? 'selected' : ''}>${esc(p.name)} (${esc(p.team_name)})</option>`).join('');
      const finished = m.status === 'finished';
      return `<div class="list-item" style="flex-direction:column;align-items:stretch;" data-result="${m.id}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
          <strong>#${m.id} · ${esc(m.home_name)} vs ${esc(m.away_name)}</strong>
          <span class="meta">${finished ? '✅ finished' : (m.locked ? '🔒 locked' : '🟢 open')} · override: ${esc(m.manual_lock)}</span>
        </div>
        <div style="margin:8px 0;">
          <span class="meta">Manual lock: </span>
          <button class="btn btn-sm ${m.manual_lock === 'auto' ? 'btn-primary' : ''}" data-lock="${m.id}" data-mode="auto">Auto</button>
          <button class="btn btn-sm ${m.manual_lock === 'open' ? 'btn-primary' : ''}" data-lock="${m.id}" data-mode="open">Force Open</button>
          <button class="btn btn-sm ${m.manual_lock === 'locked' ? 'btn-primary' : ''}" data-lock="${m.id}" data-mode="locked">Force Lock</button>
        </div>
        <div class="row">
          <div><label>Result</label><select data-r-outcome><option value="">— pick —</option>${outcomeOpts(m.result_outcome)}</select></div>
          <div><label>⭐ MVP</label><select data-r-mvp><option value="">— pick —</option>${playerOpts(m.result_mvp_player_id)}</select></div>
        </div>
        <div style="margin-top:10px;">
          <button class="btn btn-primary btn-sm" data-save-result="${m.id}">Save result &amp; finish</button>
          ${finished ? `<button class="btn btn-sm btn-danger" data-reopen="${m.id}">Reopen match</button>` : ''}
        </div>
      </div>`;
    }).join('');
    $$('[data-save-result]', el).forEach((b) => b.addEventListener('click', () => saveResult(Number(b.dataset.saveResult), true)));
    $$('[data-reopen]', el).forEach((b) => b.addEventListener('click', () => saveResult(Number(b.dataset.reopen), false)));
    $$('[data-lock]', el).forEach((b) => b.addEventListener('click', () => setLock(Number(b.dataset.lock), b.dataset.mode)));
  }
  async function saveResult(id, finished) {
    const row = $(`[data-result="${id}"]`);
    const body = finished
      ? { finished: true, outcome: $('[data-r-outcome]', row).value || null, mvpPlayerId: $('[data-r-mvp]', row).value || null }
      : { finished: false };
    try {
      await api(`/api/admin/matches/${id}/result`, { method: 'POST', body: JSON.stringify(body) });
      await refreshAll(); toast(finished ? 'Result saved — leaderboards updated.' : 'Match reopened.', 'success');
    } catch (e) { toast(e.message, 'error'); }
  }
  async function setLock(id, mode) {
    try {
      await api(`/api/admin/matches/${id}/lock`, { method: 'POST', body: JSON.stringify({ mode }) });
      await refreshAll(); toast(`Lock set to "${mode}".`, 'success');
    } catch (e) { toast(e.message, 'error'); }
  }

  /* ----------------------------- Settings / promo ----------------------------- */
  function fillSettings(s) {
    $('#promoEnabled').checked = s.promo_enabled === '1';
    $('#promoType').value = s.promo_type || 'text';
    $('#promoTitle').value = s.promo_title || '';
    $('#promoText').value = s.promo_text || '';
    $('#promoImageUrl').value = s.promo_image_url || '';
    $('#promoInsta').value = s.promo_insta || '';
    $('#promoLink').value = s.promo_link || '';
    $('#setSiteTitle').value = s.site_title || '';
    $('#setSiteTagline').value = s.site_tagline || '';
    $('#setOddsScale').value = s.odds_scale || '10';
    $('#setPointsMvp').value = s.points_mvp || '0';
    $('#setLockMinutes').value = s.lock_minutes || '0';
    $('#setMinPredictions').value = s.min_predictions || '1';
    $('#setLeaderboardSize').value = s.leaderboard_size || '100';
    $('#setDisclaimer').value = s.disclaimer || '';
    $('#setTitles').value = s.titles || '';
  }
  async function savePromo() {
    const body = JSON.stringify({
      promo_enabled: $('#promoEnabled').checked ? '1' : '0',
      promo_type: $('#promoType').value,
      promo_title: $('#promoTitle').value,
      promo_text: $('#promoText').value,
      promo_image_url: $('#promoImageUrl').value,
      promo_insta: $('#promoInsta').value,
      promo_link: $('#promoLink').value,
    });
    try { await api('/api/admin/settings', { method: 'PUT', body }); toast('Promo saved.', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  }
  async function saveRules() {
    const payload = {
      site_title: $('#setSiteTitle').value,
      site_tagline: $('#setSiteTagline').value,
      odds_scale: $('#setOddsScale').value,
      points_mvp: $('#setPointsMvp').value,
      lock_minutes: $('#setLockMinutes').value,
      min_predictions: $('#setMinPredictions').value,
      leaderboard_size: $('#setLeaderboardSize').value,
      disclaimer: $('#setDisclaimer').value,
    };
    const titles = $('#setTitles').value.trim();
    if (titles) payload.titles = titles; // server validates JSON
    try { await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(payload) }); toast('Settings saved.', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  }

  /* ----------------------------- Nav + events ----------------------------- */
  function switchView(view) {
    $$('#adminNav .tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
    $$('.view').forEach((v) => v.classList.add('hidden'));
    $(`#view-${view}`).classList.remove('hidden');
  }
  function bind() {
    $('#loginBtn').addEventListener('click', login);
    $('#themeToggle').addEventListener('click', toggleTheme);
    $('#adminPassword').addEventListener('keydown', (e) => e.key === 'Enter' && login());
    $('#logoutBtn').addEventListener('click', logout);
    $$('#adminNav .tab').forEach((t) => t.addEventListener('click', () => switchView(t.dataset.view)));
    $('#saveTeamBtn').addEventListener('click', saveTeam);
    $('#cancelTeamEdit').addEventListener('click', resetTeamForm);
    $('#savePlayerBtn').addEventListener('click', savePlayer);
    $('#cancelPlayerEdit').addEventListener('click', resetPlayerForm);
    $('#saveMatchBtn').addEventListener('click', saveMatch);
    $('#cancelMatchEdit').addEventListener('click', resetMatchForm);
    $('#savePromoBtn').addEventListener('click', savePromo);
    $('#saveRulesBtn').addEventListener('click', saveRules);
  }

  bind();
  applyThemeIcon();
  checkAuth().catch((e) => { showLogin(); toast(e.message, 'error'); });
})();
