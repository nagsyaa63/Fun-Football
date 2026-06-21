/* ===========================================================================
   Fun Football - shared.js
   Shared utilities, auth, modals, sidenav for all pages
   =========================================================================== */

(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  window.FF = window.FF || {};

  // Utilities
  window.FF.$ = $;
  window.FF.$$ = $$;
  
  window.FF.esc = function(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  window.FF.api = async function(path, opts = {}) {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  };

  let toastTimer;
  window.FF.toast = function(msg, type = '') {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = 'toast'), 2800);
  };

  // User management
  window.FF.loadUser = function() {
    try { return JSON.parse(localStorage.getItem('ff_user')) || null; }
    catch { return null; }
  };

  window.FF.saveUser = function(u) {
    localStorage.setItem('ff_user', JSON.stringify(u));
  };

  window.FF.clearUser = function() {
    localStorage.removeItem('ff_user');
  };

  // Modal helpers
  window.FF.openModal = function(id) {
    const m = $('#' + id);
    if (!m) return;
    m.classList.add('show');
    const focusable = m.querySelector('input, select, textarea, button');
    if (focusable) setTimeout(() => focusable.focus(), 30);
  };

  window.FF.closeModal = function(id) {
    const m = $('#' + id);
    if (m) m.classList.remove('show');
  };

  // Theme
  window.FF.applyThemeIcon = function() {
    const t = document.documentElement.getAttribute('data-theme') || 'light';
    const btn = $('#themeToggle');
    if (btn) btn.textContent = t === 'dark' ? '☀️' : '🌙';
    
    const sidenavBtn = $('#sidenavTheme');
    if (sidenavBtn) sidenavBtn.innerHTML = t === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
  };

  window.FF.toggleTheme = function() {
    const next = (document.documentElement.getAttribute('data-theme') || 'light') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('ff_theme', next); } catch {}
    window.FF.applyThemeIcon();
  };

  // Side navigation
  window.FF.initSidenav = function() {
    const backdrop = $('#sidenavBackdrop');
    const sidenav = $('#sidenav');
    const menuToggle = $('#menuToggle');
    const sidenavClose = $('#sidenavClose');

    if (!backdrop || !sidenav) return;

    const openSidenav = () => backdrop.classList.add('show');
    const closeSidenav = () => backdrop.classList.remove('show');

    if (menuToggle) menuToggle.addEventListener('click', openSidenav);
    if (sidenavClose) sidenavClose.addEventListener('click', closeSidenav);
    
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeSidenav();
    });

    // Update sidenav based on auth state
    const user = window.FF.loadUser();
    const sidenavAuth = $('#sidenavAuth');
    const sidenavProfile = $('#sidenavProfile');
    const sidenavLeagues = $('#sidenavLeagues');

    if (user) {
      if (sidenavAuth) sidenavAuth.classList.add('hidden');
      if (sidenavProfile) sidenavProfile.classList.remove('hidden');
      if (sidenavLeagues) sidenavLeagues.classList.remove('hidden');
    } else {
      if (sidenavAuth) sidenavAuth.classList.remove('hidden');
      if (sidenavProfile) sidenavProfile.classList.add('hidden');
      if (sidenavLeagues) sidenavLeagues.classList.add('hidden');
    }

    // Bind sidenav actions
    if (sidenavAuth) sidenavAuth.addEventListener('click', () => {
      closeSidenav();
      setTimeout(() => window.FF.openModal('authModal'), 300);
    });

    const sidenavTheme = $('#sidenavTheme');
    if (sidenavTheme) sidenavTheme.addEventListener('click', () => {
      window.FF.toggleTheme();
    });

    const sidenavHow = $('#sidenavHow');
    if (sidenavHow) sidenavHow.addEventListener('click', () => {
      closeSidenav();
      setTimeout(() => window.FF.openModal('explainModal'), 300);
    });

    if (sidenavProfile) sidenavProfile.addEventListener('click', () => {
      closeSidenav();
      setTimeout(() => {
        if (window.FF.openProfile) window.FF.openProfile();
      }, 300);
    });

    if (sidenavLeagues) sidenavLeagues.addEventListener('click', () => {
      closeSidenav();
      setTimeout(() => {
        if (window.FF.renderLeaguesList) window.FF.renderLeaguesList();
        window.FF.openModal('leaguesModal');
      }, 300);
    });
  };

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    window.FF.applyThemeIcon();
    window.FF.initSidenav();

    // Bind theme toggle in header
    const themeToggle = $('#themeToggle');
    if (themeToggle) themeToggle.addEventListener('click', window.FF.toggleTheme);

    // Close modals on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        $$('.modal-backdrop.show').forEach((m) => m.classList.remove('show'));
        const backdrop = $('#sidenavBackdrop');
        if (backdrop) backdrop.classList.remove('show');
      }
    });
  });
})();
