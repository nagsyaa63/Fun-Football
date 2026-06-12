/* ===========================================================================
   Fun Football - app.js (public site, v5)
   Adds: scoring explainer, friend leagues (+ leaderboard source selector),
   share buttons, locking-soon banner, Giant Slayer spotlight, post-match
   "you earned" + crowd breakdown, plus UX polish (countdown urgency colours,
   modal a11y, sticky leaderboard header, vote-bar reveal, loading states).
   =========================================================================== */

(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const state = {
    user: loadUser(),
    settings: null,
    teams: [],
    matches: [],
    serverOffsetMs: 0,
    activeBoard: 'overall',
    activeSource: 'global',     // 'global' or a league code
    leaderboards: null,         // global
    leagueBoards: null,         // currently-selected league
    leagues: [],                // my leagues
    standing: null,
  };

  function loadUser() { try { return JSON.parse(localStorage.getItem('ff_user')) || null; } catch { return null; } }
  function saveUser(u) { state.user = u; localStorage.setItem('ff_user', JSON.stringify(u)); }
  function clearUser() { state.user = null; localStorage.removeItem('ff_user'); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  async function api(path, opts = {}) {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  }
  let toastTimer;
  function toast(msg, type = '') {
    const t = $('#toast');
    t.textContent = msg; t.className = `toast show ${type}`;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = 'toast'), 2800);
  }
  const now = () => Date.now() + state.serverOffsetMs;

  /* ----------------------------- Modal helpers (a11y) ----------------------------- */
  function openModal(id) {
    const m = $('#' + id);
    m.classList.add('show');
    const focusable = m.querySelector('input, select, textarea, button');
    if (focusable) setTimeout(() => focusable.focus(), 30);
  }
  function closeModal(id) { $('#' + id).classList.remove('show'); }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') $$('.modal-backdrop.show').forEach((m) => m.classList.remove('show'));
  });

  /* ----------------------------- Theme ----------------------------- */
  function applyThemeIcon() {
    const t = document.documentElement.getAttribute('data-theme') || 'dark';
    const btn = $('#themeToggle'); if (btn) btn.textContent = t === 'light' ? '☀️' : '🌙';
  }
  function toggleTheme() {
    const next = (document.documentElement.getAttribute('data-theme') || 'dark') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('ff_theme', next); } catch {}
    applyThemeIcon();
  }

  /* ----------------------------- Share ----------------------------- */
  async function share(text) {
    const url = location.origin;
    const full = `${text}\n${url}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Fun Football', text, url }); return; }
      await navigator.clipboard.writeText(full);
      toast('Copied! Paste it anywhere 📋', 'success');
    } catch { /* user cancelled */ }
  }

  /* ----------------------------- Auth ----------------------------- */
  function renderUser() {
    const badge = $('#userBadge'), authBtn = $('#authBtn'), profileBtn = $('#profileBtn'), leaguesBtn = $('#leaguesBtn');
    if (state.user) {
      badge.classList.remove('hidden');
      badge.innerHTML = `👤 <strong>${esc(state.user.username)}</strong> · ${esc(state.user.id)}`;
      authBtn.classList.add('hidden'); profileBtn.classList.remove('hidden'); leaguesBtn.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
      authBtn.classList.remove('hidden'); profileBtn.classList.add('hidden'); leaguesBtn.classList.add('hidden');
      $('#myStats').classList.add('hidden');
    }
  }
  function openAuth() { $('#authError').textContent = ''; openModal('authModal'); }
  async function submitAuth() {
    const username = $('#authUsername').value.trim();
    const password = $('#authPassword').value;
    $('#authError').textContent = '';
    try {
      const data = await api('/api/users/join', { method: 'POST', body: JSON.stringify({ username, password }) });
      saveUser({ id: data.id, username: data.username, token: data.token, fanTeamId: data.fanTeamId });
      closeModal('authModal'); $('#authPassword').value = '';
      renderUser();
      toast(data.returning ? `Welcome back, ${data.username}!` : `Account created! Your ID is ${data.id}`, 'success');
      await Promise.all([loadMatches(), loadLeaderboards(), loadStanding(), loadLeagues()]);
    } catch (e) { $('#authError').textContent = e.message; }
  }

  /* ----------------------------- Profile ----------------------------- */
  async function openProfile() {
    if (!state.user) return openAuth();
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
    $('#profileFanTeam').innerHTML = '<option value="">— none —</option>' +
      state.teams.map((t) => `<option value="${t.id}" ${Number(selectedId) === t.id ? 'selected' : ''}>${esc(t.code || '')} ${esc(t.name)}</option>`).join('');
  }
  function renderProfilePoints() {
    const st = state.standing, box = $('#profilePoints');
    if (!st) { box.innerHTML = ''; return; }
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
    clearUser(); renderUser(); closeModal('profileModal');
    state.standing = null; state.leagues = []; state.activeSource = 'global'; state.leagueBoards = null;
    populateSourceSelect();
    loadMatches(); loadLeaderboards();
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
    if (!state.leagues.length) { el.innerHTML = '<p class="muted">You haven\u2019t joined any leagues yet.</p>'; return; }
    el.innerHTML = state.leagues.map((l) => `<div class="league-row">
      <div><strong>${esc(l.name)}</strong> · <code>${esc(l.code)}</code> · ${l.memberCount} member(s)</div>
      <div>
        <button class="btn btn-sm btn-share" data-share-league="${esc(l.code)}" data-name="${esc(l.name)}">Share</button>
        <button class="btn btn-sm" data-view-league="${esc(l.code)}">View</button>
      </div>
    </div>`).join('');
    $$('[data-view-league]', el).forEach((b) => b.addEventListener('click', () => {
      state.activeSource = b.dataset.viewLeague; $('#lbSource').value = state.activeSource;
      closeModal('leaguesModal'); switchSource();
    }));
    $$('[data-share-league]', el).forEach((b) => b.addEventListener('click', () =>
      share(`Join my Fun Football league "${b.dataset.name}"! Use code ${b.dataset.shareLeague} to play along with the 2026 World Cup ⚽`)));
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

  /* ----------------------------- Settings / promo / disclaimer ----------------------------- */
  async function loadSettings() {
    state.settings = await api('/api/public/settings');
    const s = state.settings;
    $('#siteTitle').textContent = s.siteTitle || 'Fun Football';
    $('#siteTagline').textContent = s.siteTagline || '';
    document.title = `${s.siteTitle || 'Fun Football'} — 2026 World Cup Predictions`;
    $('#lockNote').textContent =
      `Predict each match's RESULT (Win / Draw / Win) + the MVP. 🗡️ Bolder correct calls score more (up to ${s.oddsScale} pts); correct MVP = +${s.pointsMvp}. Tap "❓ Scoring" to learn how.`;
    $('#disclaimer').textContent = s.disclaimer || '';
    renderPromo(s.promo);
    renderTitlesLegend(s.titles || []);
  }
  function renderTitlesLegend(titles) {
    const el = $('#titlesLegend');
    el.innerHTML = !titles.length ? '' :
      '<span class="chip" style="border:none;background:none;color:var(--muted);">Titles:</span>' +
      titles.map((t) => `<span class="chip">${esc(t.emoji || '')} ${esc(t.name)} · ${t.min}+</span>`).join('');
  }
  function renderPromo(promo) {
    const box = $('#promoBox');
    if (!promo || !promo.enabled) { box.classList.add('hidden'); return; }
    let media = '';
    if ((promo.type === 'image' || promo.type === 'ad') && promo.imageUrl) {
      const img = `<img src="${esc(promo.imageUrl)}" alt="${esc(promo.title || 'Featured')}" />`;
      media = promo.link ? `<a href="${esc(promo.link)}" target="_blank" rel="noopener">${img}</a>` : img;
    }
    let body = '';
    if (promo.text) body += `<p style="margin:0;">${esc(promo.text)}</p>`;
    if (promo.type === 'insta' && promo.insta) {
      const handle = promo.insta.replace(/^@/, '');
      body += `<a class="promo-insta" href="https://instagram.com/${esc(handle)}" target="_blank" rel="noopener">📸 @${esc(handle)}</a>`;
    }
    if (promo.link && promo.type !== 'image') body += `<p style="margin:8px 0 0;"><a href="${esc(promo.link)}" target="_blank" rel="noopener">Learn more →</a></p>`;
    box.innerHTML = `${media}<div class="promo-body"><p class="promo-title">${esc(promo.title || 'Featured')}</p>${body || ''}</div>`;
    box.classList.remove('hidden');
  }
  async function loadTeams() { try { state.teams = (await api('/api/teams')).teams; } catch { state.teams = []; } }

  /* ----------------------------- My stats bar ----------------------------- */
  async function loadStanding() {
    if (!state.user) { state.standing = null; $('#myStats').classList.add('hidden'); return; }
    try { state.standing = await api(`/api/users/${encodeURIComponent(state.user.id)}/stats`); renderMyStats(); } catch {}
  }
  function renderMyStats() {
    const st = state.standing, el = $('#myStats');
    if (!st) { el.classList.add('hidden'); return; }
    const next = st.next
      ? `<div class="stat" style="flex:1;min-width:170px;">
           <span>Next: ${esc(st.next.emoji || '')} ${esc(st.next.name)} (${st.next.pointsAway} to go)</span>
           <div class="progress" style="margin-top:6px;"><i style="width:${Math.max(4, Math.min(100, Math.round((st.totalPoints / (st.next.min || 1)) * 100)))}%"></i></div>
         </div>`
      : `<div class="stat"><span>Top tier! 🐐</span></div>`;
    el.innerHTML =
      `<div class="stat"><b><span class="title-pill">${esc(st.titleEmoji || '')} ${esc(st.title)}</span></b><span>Your title</span></div>` +
      `<div class="stat"><b>${st.totalPoints || 0}</b><span>Points${st.boards && st.boards.overall.rank ? ` · #${st.boards.overall.rank}` : ''}</span></div>` +
      `<div class="stat"><b>${st.matchesAttempted || 0}</b><span>Matches</span></div>` +
      `<div class="stat"><b>${st.accuracy || 0}%</b><span>Accuracy</span></div>` + next;
    el.classList.remove('hidden');
  }

  /* ----------------------------- Matches ----------------------------- */
  async function loadMatches() {
    const q = state.user ? `?userId=${encodeURIComponent(state.user.id)}` : '';
    const data = await api(`/api/matches${q}`);
    state.matches = data.matches;
    if (data.serverTime) state.serverOffsetMs = new Date(data.serverTime).getTime() - Date.now();
    renderMatches();
    renderLockBanner();
  }
  function outcomeText(m, o) {
    return o === 'draw' ? 'Draw' : o === 'home' ? `${m.homeTeam.name} win` : o === 'away' ? `${m.awayTeam.name} win` : '';
  }
  function outcomeOptions(match, selected) {
    return [
      { v: 'home', label: `${match.homeTeam.code || ''} ${match.homeTeam.name} win` },
      { v: 'draw', label: '🤝 Draw' },
      { v: 'away', label: `${match.awayTeam.code || ''} ${match.awayTeam.name} win` },
    ].map((o) => `<option value="${o.v}" ${selected === o.v ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
  }
  function playerOptions(match, selectedId) {
    const groups = {};
    for (const p of match.players) (groups[p.teamName] = groups[p.teamName] || []).push(p);
    return Object.entries(groups).map(([team, players]) =>
      `<optgroup label="${esc(team)}">` +
      players.map((p) => `<option value="${p.id}" ${Number(selectedId) === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('') +
      `</optgroup>`).join('');
  }
  function votesHtml(m) {
    if (!m.votes || !m.votes.total) return `<div class="votes"><div class="vlabel">Votes: no predictions were made.</div></div>`;
    const p = m.votes.pct;
    const seg = (cls, pctv) => (pctv > 0 ? `<span class="${cls}" style="width:0" data-w="${pctv}">${pctv}%</span>` : '');
    return `<div class="votes">
      <div class="vlabel">What ${m.votes.total} predictor(s) picked:</div>
      <div class="votebar">${seg('vh', p.home)}${seg('vd', p.draw)}${seg('va', p.away)}</div>
      <div class="vkey">
        <span><i style="background:var(--primary)"></i>${esc(m.homeTeam.name)} ${p.home}%</span>
        <span><i style="background:var(--accent)"></i>Draw ${p.draw}%</span>
        <span><i style="background:var(--accent-2)"></i>${esc(m.awayTeam.name)} ${p.away}%</span>
      </div>
    </div>`;
  }
  function matchGroup(m) { return m.status === 'finished' ? 2 : (m.locked ? 1 : 0); }

  function renderMatches() {
    const wrap = $('#matches');
    if (!state.matches.length) { wrap.innerHTML = `<div class="card empty">No matches yet. Check back soon!</div>`; return; }
    const sorted = [...state.matches].sort((a, b) => {
      const ga = matchGroup(a), gb = matchGroup(b);
      if (ga !== gb) return ga - gb;
      const la = new Date(a.lockAt).getTime() || 0, lb = new Date(b.lockAt).getTime() || 0;
      const ka = new Date(a.kickoff).getTime() || 0, kb = new Date(b.kickoff).getTime() || 0;
      if (ga === 0) return la - lb;
      if (ga === 1) return lb - la;
      return kb - ka;
    });
    const meta = { 0: '🟢 Open — predict now', 1: '🔒 Locked — awaiting result', 2: '✅ Finished — results in' };
    const counts = { 0: 0, 1: 0, 2: 0 };
    sorted.forEach((m) => (counts[matchGroup(m)] += 1));
    let html = '', last = -1;
    for (const m of sorted) {
      const g = matchGroup(m);
      if (g !== last) { html += `<div class="group-head">${meta[g]} <span class="count">${counts[g]}</span></div>`; last = g; }
      html += matchCardHtml(m);
    }
    wrap.innerHTML = html;
    $$('[data-save]', wrap).forEach((b) => b.addEventListener('click', () => savePrediction(b.getAttribute('data-save'))));
    $$('[data-login]', wrap).forEach((b) => b.addEventListener('click', openAuth));
    $$('[data-share-match]', wrap).forEach((b) => b.addEventListener('click', () => share(b.dataset.shareMatch)));
    animateVoteBars();
    updateCountdowns();
  }

  function matchCardHtml(m) {
    const mp = m.myPrediction || {};
    const isFinished = m.status === 'finished';
    const locked = m.locked || isFinished;
    let statusTag = `<span class="status-tag status-open">Open</span>`;
    if (isFinished) statusTag = `<span class="status-tag status-finished">Finished</span>`;
    else if (locked) statusTag = `<span class="status-tag status-locked">Locked</span>`;

    let middle = '';
    if (!locked) {
      if (state.user) {
        middle = `
          <div class="row">
            <div><label>🏆 Match result</label>
              <select data-field="outcome"><option value="">— pick —</option>${outcomeOptions(m, mp.outcome)}</select></div>
            <div><label>⭐ MVP (Man of the Match)</label>
              <select data-field="mvpPlayerId"><option value="">— pick —</option>${playerOptions(m, mp.mvpPlayerId)}</select></div>
          </div>
          <div style="margin-top:14px;">
            <button class="btn btn-primary" data-save="${m.id}">Save prediction</button>
            <span class="saved-hint" data-saved="${m.id}">${m.myPrediction ? '✓ saved — editable until lock' : ''}</span>
          </div>`;
      } else {
        middle = `<div style="margin-top:8px;"><button class="btn btn-primary" data-login>🔑 Log in to predict</button>
          <span class="muted" style="margin-left:8px;font-size:13px;">Free — pick the result &amp; MVP.</span></div>`;
      }
    } else {
      middle = votesHtml(m);
    }

    let resultHtml = '';
    if (isFinished && m.result) {
      resultHtml += `<div class="result-line">Result — <strong>${esc(m.result.winnerLabel)}</strong> · ⭐ MVP: <strong>${esc(m.result.mvpName || 'TBD')}</strong></div>`;
      resultHtml += `<div class="breakdown">🗡️ Only ${m.result.sharePct}% backed <strong>${esc(m.result.winnerLabel)}</strong> → correct picks earned <strong>+${m.result.slayerPoints}</strong>.</div>`;
      if (m.myPrediction && m.myPrediction.earned !== undefined) {
        const e = m.myPrediction;
        resultHtml += e.earned > 0
          ? `<div class="earned hit">✅ You earned +${e.earned} pts${e.earnedMvp ? ` (🗡️ ${e.earnedSlayer} + ⭐ ${e.earnedMvp})` : ''}!</div>`
          : `<div class="earned miss">No points this time — better luck next match.</div>`;
        const shareTxt = e.earned > 0
          ? `I earned +${e.earned} pts on ${m.homeTeam.name} vs ${m.awayTeam.name} on Fun Football! Only ${m.result.sharePct}% backed ${m.result.winnerLabel} ⚽`
          : `I'm playing Fun Football for the 2026 World Cup — predicting results & MVPs. Join me! ⚽`;
        resultHtml += ` <button class="btn btn-sm btn-share" data-share-match="${esc(shareTxt)}">Share</button>`;
      }
    } else if (locked && m.myPrediction && m.myPrediction.outcome) {
      const pick = outcomeText(m, m.myPrediction.outcome);
      const shareTxt = `I'm backing ${pick} for ${m.homeTeam.name} vs ${m.awayTeam.name} on Fun Football ⚽`;
      resultHtml += `<div style="margin-top:8px;"><span class="muted" style="font-size:13px;">Your pick: <strong>${esc(pick)}</strong> 🔒</span>
        <button class="btn btn-sm btn-share" data-share-match="${esc(shareTxt)}">Share</button></div>`;
    }

    return `
      <div class="card match-card" data-match="${m.id}" data-kickoff="${m.kickoff}" data-lockat="${m.lockAt}" data-locked="${locked}" data-status="${m.status}">
        <div class="match-head">
          <div class="match-teams">
            <span>${esc(m.homeTeam.code || '')} ${esc(m.homeTeam.name)}</span>
            <span class="vs">vs</span>
            <span>${esc(m.awayTeam.code || '')} ${esc(m.awayTeam.name)}</span>
          </div>
          <div class="match-meta">
            ${m.stage ? `<span class="stage-pill">${esc(m.stage)}</span><br/>` : ''}
            ${statusTag}
            <div class="countdown" data-countdown>${new Date(m.kickoff).toLocaleString()}</div>
            <div class="muted" style="font-size:11px;">${m.predictionCount} prediction(s)</div>
          </div>
        </div>
        <div class="match-body">${middle}${resultHtml}</div>
      </div>`;
  }

  function animateVoteBars() {
    requestAnimationFrame(() => {
      $$('.votebar > span[data-w]').forEach((s) => { s.style.width = s.getAttribute('data-w') + '%'; });
    });
  }

  async function savePrediction(matchId) {
    if (!state.user) return openAuth();
    const card = $(`.match-card[data-match="${matchId}"]`);
    try {
      await api('/api/predictions', {
        method: 'POST',
        body: JSON.stringify({
          userId: state.user.id, matchId: Number(matchId),
          outcome: $('[data-field="outcome"]', card).value || null,
          mvpPlayerId: $('[data-field="mvpPlayerId"]', card).value || null,
        }),
      });
      const hint = $(`[data-saved="${matchId}"]`, card);
      if (hint) hint.textContent = '✓ saved — editable until lock';
      toast('Prediction saved! 🎯', 'success');
      loadMatches();
    } catch (e) { toast(e.message, 'error'); if (/lock|finished/i.test(e.message)) loadMatches(); }
  }

  function renderLockBanner() {
    const el = $('#lockBanner');
    const soonMs = 6 * 60 * 60 * 1000;
    const soon = state.matches.filter((m) => {
      if (m.status === 'finished' || m.locked) return false;
      const toLock = new Date(m.lockAt).getTime() - now();
      if (!(toLock > 0 && toLock <= soonMs)) return false;
      return state.user ? !m.myPrediction : true;
    });
    if (!soon.length) { el.classList.add('hidden'); return; }
    const names = soon.slice(0, 3).map((m) => `${m.homeTeam.name} v ${m.awayTeam.name}`).join(', ');
    const more = soon.length > 3 ? ` +${soon.length - 3} more` : '';
    el.innerHTML = state.user
      ? `⏰ <strong>${soon.length}</strong> match(es) lock within 6h that you haven't predicted: ${esc(names)}${more}.`
      : `⏰ <strong>${soon.length}</strong> match(es) lock within 6h — <a href="#" id="bannerLogin">log in to predict</a>: ${esc(names)}${more}.`;
    el.classList.remove('hidden');
    const bl = $('#bannerLogin'); if (bl) bl.addEventListener('click', (e) => { e.preventDefault(); openAuth(); });
  }

  function updateCountdowns() {
    let needsReload = false;
    $$('.match-card').forEach((card) => {
      const el = $('[data-countdown]', card);
      el.classList.remove('warn', 'danger');
      if (card.getAttribute('data-status') === 'finished') { el.textContent = 'Full time'; el.classList.remove('live'); return; }
      const lockAt = new Date(card.getAttribute('data-lockat')).getTime();
      const kickoff = new Date(card.getAttribute('data-kickoff')).getTime();
      const wasLocked = card.getAttribute('data-locked') === 'true';
      const toLock = lockAt - now(), toKick = kickoff - now();
      if (toLock > 0) {
        el.textContent = `Locks in ${fmtDur(toLock)}`;
        if (toLock < 10 * 60 * 1000) el.classList.add('danger');
        else if (toLock < 60 * 60 * 1000) el.classList.add('warn');
      } else if (toKick > 0) { el.textContent = `🔒 Locked · kickoff in ${fmtDur(toKick)}`; el.classList.add('live'); if (!wasLocked) needsReload = true; }
      else { el.textContent = '🔴 Kicked off'; el.classList.add('live'); if (!wasLocked) needsReload = true; }
    });
    if (needsReload) loadMatches();
  }
  function fmtDur(ms) {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  }

  /* ----------------------------- Spotlight ----------------------------- */
  function renderSpotlight(sp) {
    const el = $('#spotlight');
    if (!sp) { el.classList.add('hidden'); return; }
    el.innerHTML = `<p class="s-title">🗡️ Giant Slayer spotlight</p>
      <div>Boldest correct call: <strong>${esc(sp.outcomeLabel)}</strong> in <strong>${esc(sp.label)}</strong> —
      only <strong>${sp.sharePct}%</strong> backed it, earning the <strong>${sp.correctCount}</strong> who did <strong>+${sp.points} pts</strong> each. 👏</div>`;
    el.classList.remove('hidden');
  }

  /* ----------------------------- Leaderboards ----------------------------- */
  async function loadLeaderboards() {
    state.leaderboards = await api('/api/leaderboards');
    renderSpotlight(state.leaderboards.spotlight);
    if (state.user) loadStanding();
    if (state.activeSource !== 'global') { await switchSource(); } else renderLeaderboard();
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
    if (board === 'average') hint.textContent = `Average points per match. Minimum ${cfg.minPredictions} predicted matches to appear here.`;
    else if (board === 'overall') hint.textContent = 'Total points = Giant Slayer (result) points + MVP points.';
    else if (board === 'slayer') hint.textContent = `🗡️ Backing a correct result that few others picked scores more (up to ${cfg.oddsScale} pts/match).`;
    else hint.textContent = `Points from correct MVP picks (+${cfg.pointsMvp} each).`;

    $('#lbUpdated').textContent = fmtUpdated(src.generatedAt);

    const standEl = $('#lbStanding');
    if (!usingLeague && state.user && state.standing && state.standing.found) {
      const b = state.standing.boards[board];
      standEl.innerHTML = b && b.rank
        ? `📍 Your standing: <strong>#${b.rank}</strong> of ${state.standing.totalPlayers} · <strong>${b.points}${board === 'average' ? ' avg' : ' pts'}</strong>`
        : '📍 You haven\u2019t scored on this board yet — make some predictions!';
    } else if (usingLeague) {
      standEl.innerHTML = `🏟️ League: <strong>${esc(state.leagueBoards.league.name)}</strong> · code <code>${esc(state.leagueBoards.league.code)}</code> · ${state.leagueBoards.league.memberCount} member(s)`;
    } else standEl.textContent = '';

    if (!rows.length) { $('#leaderboard').innerHTML = `<div class="empty">No ranked players yet — once matches finish, scores appear here.</div>`; return; }
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
    $('#leaderboard').innerHTML = `
      <table>
        <thead><tr><th style="width:48px;">#</th><th>Player</th><th class="num">M</th><th class="num">Acc</th><th class="num">${colLabel}</th></tr></thead>
        <tbody>${body}</tbody>
      </table>`;
  }

  /* ----------------------------- Wire up ----------------------------- */
  function bindEvents() {
    $('#themeToggle').addEventListener('click', toggleTheme);
    $('#howBtn').addEventListener('click', () => openModal('explainModal'));
    $('#explainClose').addEventListener('click', () => closeModal('explainModal'));
    $('#authBtn').addEventListener('click', openAuth);
    $('#authSubmit').addEventListener('click', submitAuth);
    $('#authCancel').addEventListener('click', () => closeModal('authModal'));
    $('#authPassword').addEventListener('keydown', (e) => e.key === 'Enter' && submitAuth());
    $('#authModal').addEventListener('click', (e) => { if (e.target.id === 'authModal') closeModal('authModal'); });

    $('#profileBtn').addEventListener('click', openProfile);
    $('#profileSave').addEventListener('click', saveProfile);
    $('#profileCancel').addEventListener('click', () => closeModal('profileModal'));
    $('#profileLogout').addEventListener('click', logout);
    $('#profileModal').addEventListener('click', (e) => { if (e.target.id === 'profileModal') closeModal('profileModal'); });

    $('#leaguesBtn').addEventListener('click', () => { renderLeaguesList(); openModal('leaguesModal'); });
    $('#leaguesClose').addEventListener('click', () => closeModal('leaguesModal'));
    $('#leagueCreate').addEventListener('click', createLeague);
    $('#leagueJoin').addEventListener('click', joinLeague);
    $('#leaguesModal').addEventListener('click', (e) => { if (e.target.id === 'leaguesModal') closeModal('leaguesModal'); });
    $('#explainModal').addEventListener('click', (e) => { if (e.target.id === 'explainModal') closeModal('explainModal'); });

    $('#lbSource').addEventListener('change', switchSource);
    $$('#lbTabs .tab').forEach((tab) => tab.addEventListener('click', () => {
      $$('#lbTabs .tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeBoard = tab.getAttribute('data-board');
      renderLeaderboard();
    }));
  }

  async function init() {
    bindEvents();
    applyThemeIcon();
    renderUser();
    $('#matches').innerHTML = '<div class="card empty">Loading matches…</div>';
    $('#leaderboard').innerHTML = '<div class="empty">Loading…</div>';
    try {
      await loadSettings();
      await loadTeams();
      await loadMatches();
      await loadLeaderboards();
      await loadStanding();
      await loadLeagues();
    } catch (e) { toast(e.message, 'error'); }
    setInterval(updateCountdowns, 1000);
    setInterval(() => { loadLeaderboards().catch(() => {}); }, 60000);
  }

  init();
})();
