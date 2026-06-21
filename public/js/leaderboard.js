/* ===========================================================================
   Fun Football - leaderboard.js
   Leaderboard page
   =========================================================================== */

(() => {
  'use strict';

  const { $, $$, esc, api, toast, loadUser, saveUser, clearUser, openModal, closeModal } = window.FF;

  const state = {
    user: loadUser(),
    settings: null,
    teams: [],
    activeBoard: 'overall',
    activeSource: 'global',
    leaderboards: null,
    leagueBoards: null,
    leagues: [],
    standing: null,
  };

  /* ----------------------------- Auth & Profile ----------------------------- */
  function renderUser() {
    const authBtn = $('#authBtn'), profileBtn = $('#profileBtn');
    if (state.user) {
      if (authBtn) authBtn.classList.add('hidden');
      if (profileBtn) {
        profileBtn.classList.remove('hidden');
        profileBtn.textContent = '👤 ' + state.user.username;
      }
    } else {
      if (authBtn) authBtn.classList.remove('hidden');
      if (profileBtn) profileBtn.classList.add('hidden');
    }
    
    const sidenavAuth = $('#sidenavAuth'), sidenavProfile = $('#sidenavProfile'), sidenavLeagues = $('#sidenavLeagues');
    if (state.user) {
      if (sidenavAuth) sidenavAuth.classList.add('hidden');
      if (sidenavProfile) sidenavProfile.classList.remove('hidden');
      if (sidenavLeagues) sidenavLeagues.classList.remove('hidden');
    } else {
      if (sidenavAuth) sidenavAuth.classList.remove('hidden');
      if (sidenavProfile) sidenavProfile.classList.add('hidden');
      if (sidenavLeagues) sidenavLeagues.classList.add('hidden');
    }
  }

  async function submitAuth() {
    const username = $('#authUsername').value.trim();
    const password = $('#authPassword').value;
    $('#authError').textContent = '';
    try {
      const data = await api('/api/users/join', { method: 'POST', body: JSON.stringify({ username, password }) });
      saveUser({ id: data.id, username: data.username, token: data.token, fanTeamId: data.fanTeamId });
      closeModal('authModal'); $('#authPassword').value = '';
      renderUser();
      toast(data.returning ? `Welcome back, ${data.username}!` : `Account created!`, 'success');
      await Promise.all([loadLeaderboards(), loadStanding(), loadLeagues()]);
    } catch (e) { $('#authError').textContent = e.message; }
  }

  async function openProfile() {
    if (!state.user) return openModal('authModal');
    $('#profileError').textContent = '';
    try {
      const p = await api(`/api/users/${encodeURIComponent(state.user.id)}/profile?token=${encodeURIComponent(state.user.token)}`);
      $('#profileUsername').value = p.username || '';
      $('#profileInsta').value = p.instaUrl || '';
      fillFanTeamSelect(p.fanTeamId);
      renderProfilePoints();
      openModal('profileModal');
    } catch (e) { toast(e.message, 'error'); }
  }

  function fillFanTeamSelect(selectedId) {
    const sel = $('#profileFanTeam');
    if (!sel) return;
    sel.innerHTML = '<option value="">— none —</option>' +
      state.teams.map((t) => `<option value="${t.id}" ${Number(selectedId) === t.id ? 'selected' : ''}>${esc(t.code || '')} ${esc(t.name)}</option>`).join('');
  }

  function renderProfilePoints() {
    const st = state.standing, box = $('#profilePoints');
    if (!st || !box) return;
    const cell = (label, val, rank) => `<div class="stat"><b>${val}</b><span>${label}${rank ? ` · #${rank}` : ''}</span></div>`;
    box.innerHTML =
      `<div class="stat"><b><span class="title-pill">${esc(st.titleEmoji || '')} ${esc(st.title)}</span></b><span>Title</span></div>` +
      cell('Overall', st.boards.overall.points, st.boards.overall.rank) +
      cell('Giant Slayer', st.boards.slayer.points, st.boards.slayer.rank) +
      cell('MVP', st.boards.mvp.points, st.boards.mvp.rank) +
      cell('Average', (st.boards.average.points || 0), st.boards.average.rank);
  }

  async function saveProfile() {
    $('#profileError').textContent = '';
    try {
      const data = await api('/api/users/profile', {
        method: 'POST',
        body: JSON.stringify({
          userId: state.user.id, token: state.user.token,
          username: $('#profileUsername').value.trim(),
          fanTeamId: $('#profileFanTeam').value || null,
          instaUrl: $('#profileInsta').value.trim(),
        }),
      });
      saveUser({ ...state.user, username: data.username, fanTeamId: data.fanTeamId });
      renderUser(); closeModal('profileModal');
      toast('Profile saved! ✅', 'success');
      loadLeaderboards();
    } catch (e) { $('#profileError').textContent = e.message; }
  }

  function logout() {
    clearUser(); state.user = null; state.standing = null; state.leagues = [];
    state.activeSource = 'global'; state.leagueBoards = null;
    populateSourceSelect();
    renderUser(); closeModal('profileModal');
    loadLeaderboards();
    toast('Logged out.');
  }

  /* ----------------------------- Leagues ----------------------------- */
  async function loadLeagues() {
    if (!state.user) { state.leagues = []; populateSourceSelect(); return; }
    try {
      state.leagues = (await api(`/api/leagues/mine?userId=${encodeURIComponent(state.user.id)}&token=${encodeURIComponent(state.user.token)}`)).leagues;
    } catch { state.leagues = []; }
    populateSourceSelect();
    renderLeaguesList();
  }

  function populateSourceSelect() {
    const sel = $('#lbSource');
    if (!sel) return;
    sel.innerHTML = '<option value="global">🌍 Global</option>' +
      state.leagues.map((l) => `<option value="${esc(l.code)}">🏟️ ${esc(l.name)} (${l.memberCount})</option>`).join('');
    sel.value = state.activeSource;
  }

  function renderLeaguesList() {
    const el = $('#leaguesList');
    if (!el) return;
    if (!state.leagues.length) { el.innerHTML = '<p class="muted">You haven\u2019t joined any leagues yet.</p>'; return; }
    el.innerHTML = state.leagues.map((l) => `<div class="league-row">
      <div><strong>${esc(l.name)}</strong> · <code>${esc(l.code)}</code> · ${l.memberCount} member(s)</div>
      <div>
        <button class="btn btn-sm" data-view-league="${esc(l.code)}">View</button>
      </div>
    </div>`).join('');
    $$('[data-view-league]', el).forEach((b) => b.addEventListener('click', () => {
      state.activeSource = b.dataset.viewLeague; $('#lbSource').value = state.activeSource;
      closeModal('leaguesModal'); switchSource();
    }));
  }

  async function createLeague() {
    $('#leaguesError').textContent = '';
    try {
      const d = await api('/api/leagues', { method: 'POST', body: JSON.stringify({ userId: state.user.id, token: state.user.token, name: $('#leagueName').value.trim() }) });
      $('#leagueName').value = '';
      await loadLeagues();
      toast(`League created! Code: ${d.code}`, 'success');
    } catch (e) { $('#leaguesError').textContent = e.message; }
  }

  async function joinLeague() {
    $('#leaguesError').textContent = '';
    try {
      const d = await api('/api/leagues/join', { method: 'POST', body: JSON.stringify({ userId: state.user.id, token: state.user.token, code: $('#leagueCode').value.trim() }) });
      $('#leagueCode').value = '';
      await loadLeagues();
      toast(`Joined "${d.name}"!`, 'success');
    } catch (e) { $('#leaguesError').textContent = e.message; }
  }

  async function switchSource() {
    state.activeSource = $('#lbSource').value;
    if (state.activeSource === 'global') { state.leagueBoards = null; renderLeaderboard(); return; }
    try {
      state.leagueBoards = await api(`/api/leagues/${encodeURIComponent(state.activeSource)}/leaderboard?userId=${encodeURIComponent(state.user.id)}&token=${encodeURIComponent(state.user.token)}`);
    } catch (e) { toast(e.message, 'error'); state.leagueBoards = null; }
    renderLeaderboard();
  }

  /* ----------------------------- Settings ----------------------------- */
  async function loadSettings() {
    try {
      state.settings = await api('/api/public/settings');
      const s = state.settings;
      const titleEl = $('#siteTitle');
      const taglineEl = $('#siteTagline');
      if (titleEl) titleEl.textContent = s.siteTitle || 'Fun Football';
      if (taglineEl) taglineEl.textContent = s.siteTagline || '';
      document.title = `Leaderboard — ${s.siteTitle || 'Fun Football'}`;
      renderTitlesLegend(s.titles || []);
    } catch (e) { console.error('Failed to load settings:', e); }
  }

  function renderTitlesLegend(titles) {
    const el = $('#titlesLegend');
    if (!el) return;
    el.innerHTML = !titles.length ? '' :
      '<span class="chip" style="border:none;background:none;color:var(--muted);">Titles:</span>' +
      titles.map((t) => `<span class="chip">${esc(t.emoji || '')} ${esc(t.name)} · ${t.min}+</span>`).join('');
  }

  async function loadTeams() {
    try { state.teams = (await api('/api/teams')).teams; }
    catch { state.teams = []; }
  }

  async function loadStanding() {
    if (!state.user) { state.standing = null; return; }
    try { state.standing = await api(`/api/users/${encodeURIComponent(state.user.id)}/stats`); }
    catch {}
  }

  /* ----------------------------- Leaderboards ----------------------------- */
  async function loadLeaderboards() {
    try {
      state.leaderboards = await api('/api/leaderboards');
      renderSpotlight(state.leaderboards.spotlight);
      if (state.user) loadStanding();
      if (state.activeSource !== 'global') { await switchSource(); } else renderLeaderboard();
    } catch (e) {
      toast('Failed to load leaderboards', 'error');
    }
  }

  function renderSpotlight(sp) {
    const el = $('#spotlight');
    if (!el || !sp) { if (el) el.classList.add('hidden'); return; }
    el.innerHTML = `<p class="s-title">🗡️ Giant Slayer spotlight</p>
      <div>Boldest correct call: <strong>${esc(sp.outcomeLabel)}</strong> in <strong>${esc(sp.label)}</strong> —
      only <strong>${sp.sharePct}%</strong> backed it, earning the <strong>${sp.correctCount}</strong> who did <strong>+${sp.points} pts</strong> each. 👏</div>`;
    el.classList.remove('hidden');
  }

  function fmtUpdated(iso) {
    const d = new Date(iso); if (!Number.isFinite(d.getTime())) return '';
    const opt = { dateStyle: 'medium', timeStyle: 'short' };
    const ist = d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', ...opt });
    const utc = d.toLocaleString('en-GB', { timeZone: 'UTC', ...opt });
    return `🕒 Last updated: ${ist} IST · ${utc} UTC`;
  }

  function renderLeaderboard() {
    if (!state.leaderboards) return;
    const board = state.activeBoard;
    const usingLeague = state.activeSource !== 'global' && state.leagueBoards;
    const src = usingLeague ? state.leagueBoards : state.leaderboards;
    const rows = (src.boards && src.boards[board]) || [];
    const cfg = state.leaderboards.config;
    
    const valueFor = (e) => {
      switch (board) {
        case 'slayer': return `${e.slayerPoints} pts`;
        case 'mvp': return `${e.mvpPoints} pts`;
        case 'average': return `${(typeof e.averagePoints === 'number' ? e.averagePoints.toFixed(2) : e.averagePoints)} avg`;
        default: return `${e.totalPoints} pts`;
      }
    };
    
    const colLabel = board === 'average' ? 'Avg / match' : 'Points';
    const hint = $('#lbHint');
    if (hint) {
      if (board === 'average') hint.textContent = `Average points per match. Minimum ${cfg.minPredictions} predicted matches to appear here.`;
      else if (board === 'overall') hint.textContent = 'Total points = Giant Slayer (result) points + MVP points.';
      else if (board === 'slayer') hint.textContent = `🗡️ Backing a correct result that few others picked scores more (up to ${cfg.oddsScale} pts/match).`;
      else hint.textContent = `Points from correct MVP picks (+${cfg.pointsMvp} each).`;
    }

    const updatedEl = $('#lbUpdated');
    if (updatedEl) updatedEl.textContent = fmtUpdated(src.generatedAt);

    const standEl = $('#lbStanding');
    if (standEl) {
      if (!usingLeague && state.user && state.standing && state.standing.found) {
        const b = state.standing.boards[board];
        standEl.innerHTML = b && b.rank
          ? `📍 Your standing: <strong>#${b.rank}</strong> of ${state.standing.totalPlayers} · <strong>${b.points}${board === 'average' ? ' avg' : ' pts'}</strong>`
          : '📍 You haven\u2019t scored on this board yet.';
      } else if (usingLeague) {
        standEl.innerHTML = `🏟️ League: <strong>${esc(state.leagueBoards.league.name)}</strong> · code <code>${esc(state.leagueBoards.league.code)}</code> · ${state.leagueBoards.league.memberCount} member(s)`;
      } else standEl.textContent = '';
    }

    const lbEl = $('#leaderboard');
    if (!lbEl) return;
    
    if (!rows.length) { lbEl.innerHTML = `<div class="empty">No ranked players yet.</div>`; return; }
    
    const myId = state.user && state.user.id;
    const body = rows.map((e) => {
      const rankCls = e.rank <= 3 ? `rank-${e.rank}` : '';
      const medal = e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : e.rank;
      const isMe = myId && e.userId === myId;
      const fan = e.fanTeamCode ? ` <span title="${esc(e.fanTeamName || '')}">${esc(e.fanTeamCode)}</span>` : '';
      return `<tr class="${isMe ? 'me-row' : ''}">
        <td class="${rankCls}">${medal}</td>
        <td>${esc(e.username)}${fan}${isMe ? '<span class="you-chip">YOU</span>' : ''} <span class="title-pill" style="font-size:10px;">${esc(e.titleEmoji || '')} ${esc(e.title)}</span></td>
        <td class="num">${e.matchesAttempted}</td>
        <td class="num">${e.accuracy}%</td>
        <td class="num"><strong>${valueFor(e)}</strong></td>
      </tr>`;
    }).join('');
    
    lbEl.innerHTML = `
      <table>
        <thead><tr><th style="width:48px;">#</th><th>Player</th><th class="num">M</th><th class="num">Acc</th><th class="num">${colLabel}</th></tr></thead>
        <tbody>${body}</tbody>
      </table>`;
  }

  /* ----------------------------- Wire up ----------------------------- */
  function bindEvents() {
    const authBtn = $('#authBtn'), authSubmit = $('#authSubmit'), authCancel = $('#authCancel');
    const authPassword = $('#authPassword'), authModal = $('#authModal');
    if (authBtn) authBtn.addEventListener('click', () => openModal('authModal'));
    if (authSubmit) authSubmit.addEventListener('click', submitAuth);
    if (authCancel) authCancel.addEventListener('click', () => closeModal('authModal'));
    if (authPassword) authPassword.addEventListener('keydown', (e) => e.key === 'Enter' && submitAuth());
    if (authModal) authModal.addEventListener('click', (e) => { if (e.target.id === 'authModal') closeModal('authModal'); });

    const profileBtn = $('#profileBtn'), profileSave = $('#profileSave');
    const profileCancel = $('#profileCancel'), profileLogout = $('#profileLogout'), profileModal = $('#profileModal');
    if (profileBtn) profileBtn.addEventListener('click', openProfile);
    if (profileSave) profileSave.addEventListener('click', saveProfile);
    if (profileCancel) profileCancel.addEventListener('click', () => closeModal('profileModal'));
    if (profileLogout) profileLogout.addEventListener('click', logout);
    if (profileModal) profileModal.addEventListener('click', (e) => { if (e.target.id === 'profileModal') closeModal('profileModal'); });

    const explainClose = $('#explainClose'), explainModal = $('#explainModal');
    if (explainClose) explainClose.addEventListener('click', () => closeModal('explainModal'));
    if (explainModal) explainModal.addEventListener('click', (e) => { if (e.target.id === 'explainModal') closeModal('explainModal'); });

    const leaguesClose = $('#leaguesClose'), leagueCreate = $('#leagueCreate');
    const leagueJoin = $('#leagueJoin'), leaguesModal = $('#leaguesModal');
    if (leaguesClose) leaguesClose.addEventListener('click', () => closeModal('leaguesModal'));
    if (leagueCreate) leagueCreate.addEventListener('click', createLeague);
    if (leagueJoin) leagueJoin.addEventListener('click', joinLeague);
    if (leaguesModal) leaguesModal.addEventListener('click', (e) => { if (e.target.id === 'leaguesModal') closeModal('leaguesModal'); });

    const lbSource = $('#lbSource');
    if (lbSource) lbSource.addEventListener('change', switchSource);
    
    $$('#lbTabs .tab').forEach((tab) => tab.addEventListener('click', () => {
      $$('#lbTabs .tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeBoard = tab.getAttribute('data-board');
      renderLeaderboard();
    }));
  }

  window.FF.openProfile = openProfile;
  window.FF.renderLeaguesList = renderLeaguesList;

  async function init() {
    bindEvents();
    renderUser();
    const lbEl = $('#leaderboard');
    if (lbEl) lbEl.innerHTML = '<div class="empty">Loading…</div>';
    
    try {
      await loadSettings();
      await loadTeams();
      await loadLeaderboards();
      await loadStanding();
      await loadLeagues();
    } catch (e) { toast(e.message, 'error'); }
    
    setInterval(() => { loadLeaderboards().catch(() => {}); }, 60000);
  }

  init();
})();
