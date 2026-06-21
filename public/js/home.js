/* ===========================================================================
   Fun Football - home.js
   Home page with stats card and feature cards
   =========================================================================== */

(() => {
  'use strict';

  const { $, $$, esc, api, toast, loadUser, saveUser, clearUser, openModal, closeModal } = window.FF;

  const state = {
    user: loadUser(),
    settings: null,
    teams: [],
    standing: null,
  };

  /* ----------------------------- Auth ----------------------------- */
  function renderUser() {
    const authBtn = $('#authBtn');
    const profileBtn = $('#profileBtn');
    
    if (state.user) {
      if (authBtn) authBtn.classList.add('hidden');
      if (profileBtn) {
        profileBtn.classList.remove('hidden');
        profileBtn.textContent = '👤 ' + state.user.username;
      }
    } else {
      if (authBtn) authBtn.classList.remove('hidden');
      if (profileBtn) profileBtn.classList.add('hidden');
      $('#myStats').classList.add('hidden');
    }
    
    // Update sidenav
    const sidenavAuth = $('#sidenavAuth');
    const sidenavProfile = $('#sidenavProfile');
    const sidenavLeagues = $('#sidenavLeagues');
    
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
      const data = await api('/api/users/join', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      saveUser({
        id: data.id,
        username: data.username,
        token: data.token,
        fanTeamId: data.fanTeamId
      });
      closeModal('authModal');
      $('#authPassword').value = '';
      renderUser();
      toast(data.returning ? `Welcome back, ${data.username}!` : `Account created!`, 'success');
      await loadStanding();
    } catch (e) {
      $('#authError').textContent = e.message;
    }
  }

  /* ----------------------------- Profile ----------------------------- */
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
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function fillFanTeamSelect(selectedId) {
    const sel = $('#profileFanTeam');
    if (!sel) return;
    sel.innerHTML = '<option value="">— none —</option>' +
      state.teams.map((t) => `<option value="${t.id}" ${Number(selectedId) === t.id ? 'selected' : ''}>${esc(t.code || '')} ${esc(t.name)}</option>`).join('');
  }

  function renderProfilePoints() {
    const st = state.standing;
    const box = $('#profilePoints');
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
          userId: state.user.id,
          token: state.user.token,
          username: $('#profileUsername').value.trim(),
          fanTeamId: $('#profileFanTeam').value || null,
          instaUrl: $('#profileInsta').value.trim(),
        }),
      });
      saveUser({ ...state.user, username: data.username, fanTeamId: data.fanTeamId });
      renderUser();
      closeModal('profileModal');
      toast('Profile saved! ✅', 'success');
    } catch (e) {
      $('#profileError').textContent = e.message;
    }
  }

  function logout() {
    clearUser();
    state.user = null;
    state.standing = null;
    renderUser();
    closeModal('profileModal');
    $('#myStats').classList.add('hidden');
    toast('Logged out.');
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
      document.title = `${s.siteTitle || 'Fun Football'} — 2026 World Cup Predictions`;
      renderPromo(s.promo);
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  }

  function renderPromo(promo) {
    const box = $('#promoBox');
    if (!box || !promo || !promo.enabled) {
      if (box) box.classList.add('hidden');
      return;
    }
    
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
    if (promo.link && promo.type !== 'image') {
      body += `<p style="margin:8px 0 0;"><a href="${esc(promo.link)}" target="_blank" rel="noopener">Learn more →</a></p>`;
    }
    
    box.innerHTML = `${media}<div class="promo-body"><p class="promo-title">${esc(promo.title || 'Featured')}</p>${body || ''}</div>`;
    box.classList.remove('hidden');
  }

  async function loadTeams() {
    try {
      state.teams = (await api('/api/teams')).teams;
    } catch {
      state.teams = [];
    }
  }

  /* ----------------------------- My stats bar ----------------------------- */
  async function loadStanding() {
    if (!state.user) {
      state.standing = null;
      $('#myStats').classList.add('hidden');
      return;
    }
    try {
      state.standing = await api(`/api/users/${encodeURIComponent(state.user.id)}/stats`);
      renderMyStats();
    } catch (e) {
      console.error('Failed to load standing:', e);
    }
  }

  function renderMyStats() {
    const st = state.standing;
    const el = $('#myStats');
    if (!st || !el) {
      if (el) el.classList.add('hidden');
      return;
    }
    
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
      `<div class="stat"><b>${st.accuracy || 0}%</b><span>Accuracy</span></div>` +
      next +
      `<div class="stats-actions">
        <a href="/predictions.html" class="btn btn-primary">⚽ View Predictions</a>
        <a href="/leaderboard.html" class="btn btn-primary">🏆 View Leaderboard</a>
      </div>`;
    
    el.classList.remove('hidden');
  }

  /* ----------------------------- Wire up ----------------------------- */
  function bindEvents() {
    const authBtn = $('#authBtn');
    const authSubmit = $('#authSubmit');
    const authCancel = $('#authCancel');
    const authPassword = $('#authPassword');
    const authModal = $('#authModal');
    
    if (authBtn) authBtn.addEventListener('click', () => openModal('authModal'));
    if (authSubmit) authSubmit.addEventListener('click', submitAuth);
    if (authCancel) authCancel.addEventListener('click', () => closeModal('authModal'));
    if (authPassword) authPassword.addEventListener('keydown', (e) => e.key === 'Enter' && submitAuth());
    if (authModal) authModal.addEventListener('click', (e) => {
      if (e.target.id === 'authModal') closeModal('authModal');
    });

    const profileBtn = $('#profileBtn');
    const profileSave = $('#profileSave');
    const profileCancel = $('#profileCancel');
    const profileLogout = $('#profileLogout');
    const profileModal = $('#profileModal');
    
    if (profileBtn) profileBtn.addEventListener('click', openProfile);
    if (profileSave) profileSave.addEventListener('click', saveProfile);
    if (profileCancel) profileCancel.addEventListener('click', () => closeModal('profileModal'));
    if (profileLogout) profileLogout.addEventListener('click', logout);
    if (profileModal) profileModal.addEventListener('click', (e) => {
      if (e.target.id === 'profileModal') closeModal('profileModal');
    });

    const explainClose = $('#explainClose');
    const explainModal = $('#explainModal');
    const howBtn = $('#howBtn');
    
    if (howBtn) howBtn.addEventListener('click', () => openModal('explainModal'));
    if (explainClose) explainClose.addEventListener('click', () => closeModal('explainModal'));
    if (explainModal) explainModal.addEventListener('click', (e) => {
      if (e.target.id === 'explainModal') closeModal('explainModal');
    });
  }

  // Make profile function available globally for sidenav
  window.FF.openProfile = openProfile;

  async function init() {
    bindEvents();
    renderUser();
    
    try {
      await loadSettings();
      await loadTeams();
      await loadStanding();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  init();
})();
