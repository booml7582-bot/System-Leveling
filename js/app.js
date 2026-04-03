// ============================================
// SOLO LEVELING SYSTEM — App Entry Point
// ============================================

import { Router } from './router.js';
import { state } from './state.js';
import { storage } from './services/storage.js';
import { notificationService } from './services/notifications.js';
import { renderSetup } from './pages/setup.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderAttributes } from './pages/attributes.js';
import { renderRank } from './pages/rank.js';
import { renderReEval } from './pages/reeval.js';
import { renderModify } from './pages/modify.js';
import { renderSettings } from './pages/settings.js';
import { renderProfile } from './pages/profile.js';

// SVG icons — clean, minimal, no emojis
const ICONS = {
  quests: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`,
  stats: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="3" width="4" height="18"/></svg>`,
  rank: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>`,
  eval: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>`,
  profile: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  modify: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1.08z"/></svg>`,
};

const NAV_ITEMS = [
  { route: '/dashboard', icon: ICONS.quests, label: 'Quests' },
  { route: '/attributes', icon: ICONS.stats, label: 'Stats' },
  { route: '/rank', icon: ICONS.rank, label: 'Rank' },
  { route: '/profile', icon: ICONS.profile, label: 'Profile' },
  { route: '/reeval', icon: ICONS.eval, label: 'Eval' },
  { route: '/modify', icon: ICONS.modify, label: 'Config' },
];

async function init() {
  await storage.init();

  // Initialize push notifications
  await notificationService.init();

  const profile = await storage.get('profile', 'player');
  const attributes = await storage.getAll('attributes');
  const tasks = await storage.getAll('tasks');
  const settings = await storage.get('settings', 'main');
  const rankHistory = await storage.getAll('rankHistory');

  state.update({ profile, attributes, tasks, settings, rankHistory });

  const app = document.getElementById('app');
  app.innerHTML = `
    <main id="page-container" class="page-transition"></main>
    <nav class="nav-bar" id="nav-bar" style="${!profile ? 'display:none;' : ''}">
      ${NAV_ITEMS.map(item => `
        <a class="nav-item" data-route="${item.route}" href="#${item.route}">
          <span class="nav-icon">${item.icon}</span>
          <span>${item.label}</span>
        </a>
      `).join('')}
    </nav>
  `;

  const router = new Router();

  router.guard(async (path) => {
    const hasProfile = state.get('profile');
    const navBar = document.getElementById('nav-bar');
    if (!hasProfile && path !== '/setup') {
      if (navBar) navBar.style.display = 'none';
      return '/setup';
    }
    if (hasProfile && path === '/setup') {
      if (navBar) navBar.style.display = '';
      return '/dashboard';
    }
    if (hasProfile && path === '/') return '/dashboard';
    if (navBar) navBar.style.display = hasProfile ? '' : 'none';
    return null;
  });

  router
    .route('/setup', renderSetup)
    .route('/dashboard', renderDashboard)
    .route('/attributes', renderAttributes)
    .route('/rank', renderRank)
    .route('/reeval', renderReEval)
    .route('/modify', renderModify)
    .route('/settings', renderSettings)
    .route('/profile', renderProfile);

  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    setTimeout(() => {
      loadingScreen.classList.add('hidden');
      setTimeout(() => loadingScreen.remove(), 600);
    }, 1500);
  }

  setTimeout(() => router.start(), 1600);
}

document.addEventListener('DOMContentLoaded', init);
