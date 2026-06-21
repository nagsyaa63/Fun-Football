/* ===========================================================================
   Fun Football - predictions.js  
   Match predictions page
   =========================================================================== */

(() => {
  'use strict';

  const { $, $$, esc, api, toast, loadUser, saveUser, clearUser, openModal, closeModal } = window.FF;

  const state = {
    user: loadUser(),
    settings: null,
    teams: [],
    matches: [],
    serverOffsetMs: 0,
  };

  const now = () => Date.now() + state.serverOffsetMs;

  /* ----------------------------- Auth & Profile (same as home.js) ----------------------------- */
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
    
    // Update sidenav
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
      await loadMatches();
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
      openModal('profileModal');
    } catch (e) { toast(e.message, 'error'); }
  }

  function fillFanTeamSelect(selectedId) {
    const sel = $('#profileFanTeam');
    if (!sel) return;
    sel.innerHTML = '<option value="">— none —</option>' +
      state.teams.map((t) => `<option value="${t.id}" ${Number(selectedId) === t.id ? 'selected' : ''}>${esc(t.code || '')} ${esc(t.name)}</option>`).join('');
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
    } catch (e) { $('#profileError').textContent = e.message; }
  }

  function logout() {
    clearUser(); state.user = null; renderUser(); closeModal('profileModal');
    toast('Logged out.');
    loadMatches();
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
      document.title = `Predictions — ${s.siteTitle || 'Fun Football'}`;
      const lockNote = $('#lockNote');
      if (lockNote) {
        lockNote.textContent = `Predict each match's result (Win / Draw / Win) + the MVP. Bold correct calls score more (up to ${s.oddsScale} pts); correct MVP = +${s.pointsMvp}.`;
      }
    } catch (e) { console.error('Failed to load settings:', e); }
  }

  async function loadTeams() {
    try { state.teams = (await api('/api/teams')).teams; }
    catch { state.teams = []; }
  }

  /* ----------------------------- Matches ----------------------------- */
  async function loadMatches() {
    const q = state.user ? `?userId=${encodeURIComponent(state.user.id)}` : '';
    try {
      const data = await api(`/api/matches${q}`);
      state.matches = data.matches;
      if (data.serverTime) state.serverOffsetMs = new Date(data.serverTime).getTime() - Date.now();
      renderMatches();
      renderLockBanner();
    } catch (e) {
      toast('Failed to load matches', 'error');
    }
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
    const isFinished = m.status === 'finished';
    
    if (!m.votes || !m.votes.total) {
      return `<div class="votes"><div class="vlabel">No predictions were made.</div></div>`;
    }
    
    const p = m.votes.pct;
    
    // For finished matches, show accuracy chart (correct vs incorrect)
    if (isFinished && m.result) {
      // Calculate correct vs incorrect predictions
      const correctOutcome = m.result.outcome; // 'home', 'draw', or 'away'
      let correctCount = 0;
      
      if (correctOutcome === 'home') correctCount = Math.round(m.votes.total * p.home / 100);
      else if (correctOutcome === 'draw') correctCount = Math.round(m.votes.total * p.draw / 100);
      else if (correctOutcome === 'away') correctCount = Math.round(m.votes.total * p.away / 100);
      
      const incorrectCount = m.votes.total - correctCount;
      const correctPct = Math.round((correctCount / m.votes.total) * 100);
      const incorrectPct = 100 - correctPct;
      
      return `<div class="prediction-chart">
        <div class="vlabel">${m.votes.total} total predictions — accuracy breakdown:</div>
        
        <!-- Accuracy Chart -->
        <div class="chart-container">
          <div class="pie-chart">
            ${generateAccuracyChart(correctPct, incorrectPct)}
            <div class="pie-center">
              <div class="pie-center-value">${correctPct}%</div>
              <div class="pie-center-label">Correct</div>
            </div>
          </div>
          <div class="chart-legend">
            <div class="legend-item">
              <div class="legend-color correct"></div>
              <div class="legend-text">
                <span class="legend-label">✓ Correct</span>
                <span class="legend-value">${correctCount} (${correctPct}%)</span>
              </div>
            </div>
            <div class="legend-item">
              <div class="legend-color incorrect"></div>
              <div class="legend-text">
                <span class="legend-label">✗ Incorrect</span>
                <span class="legend-value">${incorrectCount} (${incorrectPct}%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    }
    
    // For locked (not finished) matches, show horizontal bar
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

  function generateAccuracyChart(correct, incorrect) {
    const circumference = 377;
    const radius = 60;
    
    const correctSegment = (correct / 100) * circumference;
    const incorrectSegment = (incorrect / 100) * circumference;
    
    const colorCorrect = '#2ecc71'; // Bright green for correct
    const colorIncorrect = '#e74c3c'; // Red for incorrect
    
    return `
      <svg viewBox="0 0 160 160">
        <circle cx="80" cy="80" r="${radius}" stroke="var(--border)" stroke-width="32" fill="none" opacity="0.2"/>
        ${correct > 0 ? `
        <circle 
          cx="80" 
          cy="80" 
          r="${radius}"
          stroke="${colorCorrect}"
          stroke-dasharray="${correctSegment} ${circumference}"
          stroke-dashoffset="0"
          data-segment="correct"
        />` : ''}
        ${incorrect > 0 ? `
        <circle 
          cx="80" 
          cy="80" 
          r="${radius}"
          stroke="${colorIncorrect}"
          stroke-dasharray="${incorrectSegment} ${circumference}"
          stroke-dashoffset="${-correctSegment}"
          data-segment="incorrect"
        />` : ''}
      </svg>
    `;
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
    $$('[data-login]', wrap).forEach((b) => b.addEventListener('click', () => openModal('authModal')));
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
            <span class="saved-hint" data-saved="${m.id}">${m.myPrediction ? '✓ saved' : ''}</span>
          </div>`;
      } else {
        middle = `<div style="margin-top:8px;"><button class="btn btn-primary" data-login>🔑 Log in to predict</button></div>`;
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
          : `<div class="earned miss">No points this time.</div>`;
      }
    } else if (locked && m.myPrediction && m.myPrediction.outcome) {
      const pick = outcomeText(m, m.myPrediction.outcome);
      resultHtml += `<div style="margin-top:8px;"><span class="muted" style="font-size:13px;">Your pick: <strong>${esc(pick)}</strong> 🔒</span></div>`;
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
    if (!state.user) return openModal('authModal');
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
      if (hint) hint.textContent = '✓ saved';
      toast('Prediction saved! 🎯', 'success');
      loadMatches();
    } catch (e) { toast(e.message, 'error'); if (/lock|finished/i.test(e.message)) loadMatches(); }
  }

  function renderLockBanner() {
    const el = $('#lockBanner');
    if (!el) return;
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
    const bl = $('#bannerLogin'); if (bl) bl.addEventListener('click', (e) => { e.preventDefault(); openModal('authModal'); });
  }

  function updateCountdowns() {
    let needsReload = false;
    $$('.match-card').forEach((card) => {
      const el = $('[data-countdown]', card);
      if (!el) return;
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
  }

  window.FF.openProfile = openProfile;

  async function init() {
    bindEvents();
    renderUser();
    $('#matches').innerHTML = '<div class="card empty">Loading matches…</div>';
    try {
      await loadSettings();
      await loadTeams();
      await loadMatches();
    } catch (e) { toast(e.message, 'error'); }
    setInterval(updateCountdowns, 1000);
  }

  init();
})();
