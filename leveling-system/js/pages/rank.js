// ============================================
// SOLO LEVELING SYSTEM — Rank Page
// ============================================

import { state } from '../state.js';
import { rankEngine } from '../engines/rank-engine.js';
import { attributeEngine } from '../engines/attribute-engine.js';
import { taskEngine } from '../engines/task-engine.js';

export async function renderRank(container) {
  const profile = state.get('profile');
  const attributes = state.get('attributes') || [];
  if (!profile) { window.location.hash = '/setup'; return; }

  const attrStats = attributeEngine.getStats(attributes);
  const history = await taskEngine.getCompletionHistory(30);
  const rankHistory = await rankEngine.getRankHistory();
  const nextRank = rankEngine.getNextRankProgress(profile.currentRank, attrStats.totalXP, history.recentRate, history.recentRate);
  const ranks = rankEngine.getRanks();
  const currentIdx = rankEngine.getRankIndex(profile.currentRank);

  const rankColors = { E: 'var(--rank-E)', D: 'var(--rank-D)', C: 'var(--rank-C)', B: 'var(--rank-B)', A: 'var(--rank-A)', S: 'var(--rank-S)' };

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div class="page-subtitle">Hunter Classification</div>
        <h1 class="page-title">Rank Progress</h1>
      </div>

      <div class="rank-page-center">
        <div class="rank-badge-large rank-display rank-${profile.currentRank}" style="width:120px;height:120px;font-size:4rem;border-radius:var(--radius-2xl);border-width:3px;">
          ${profile.currentRank}
        </div>
        <h2 class="rank-title" style="color:${rankColors[profile.currentRank]};">${rankEngine.getRankName(profile.currentRank)}</h2>
        <p class="rank-subtitle">Total XP: ${attrStats.totalXP} / Completion: ${history.recentRate}%</p>
      </div>

      <div class="rank-timeline">
        ${ranks.map((rank, i) => {
          const achieved = i <= currentIdx;
          const current = i === currentIdx;
          return `
            ${i > 0 ? `<div class="rank-timeline-line" style="background:${achieved ? rankColors[ranks[i-1]] : 'var(--color-border-subtle)'};"></div>` : ''}
            <div class="rank-timeline-item">
              <div class="rank-timeline-dot ${achieved ? 'achieved' : 'locked'} ${current ? 'current' : ''}"
                   style="color:${rankColors[rank]};border-color:${achieved ? rankColors[rank] : 'var(--color-border-subtle)'};background:${achieved ? rankColors[rank] + '20' : 'transparent'};">
                ${rank}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      ${nextRank.nextRank ? `
        <div class="section">
          <div class="section-title">Next Rank: ${nextRank.nextRank}</div>
          <div class="card" style="margin-bottom:var(--space-4);">
            <div class="card-body">
              <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-3);">
                <span>Overall Progress</span>
                <span class="text-accent" style="font-family:var(--font-heading);font-weight:600;">${nextRank.progress}%</span>
              </div>
              <div class="progress progress-lg" style="margin-bottom:var(--space-4);">
                <div class="progress-fill" style="width:${nextRank.progress}%;"></div>
              </div>
              ${Object.entries(nextRank.requirements).map(([key, req]) => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-2) 0;border-bottom:1px solid var(--color-border-subtle);">
                  <span style="font-size:var(--text-sm);text-transform:capitalize;">${key.replace(/([A-Z])/g, ' $1')}</span>
                  <div style="display:flex;align-items:center;gap:var(--space-2);">
                    <span style="font-family:var(--font-heading);font-size:var(--text-sm);">${Math.round(req.current)} / ${req.needed}</span>
                    <span style="color:${req.met ? 'var(--color-accent-success)' : 'var(--color-text-muted)'};">${req.met ? '/' : 'x'}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      ` : `
        <div class="card card-glow" style="text-align:center;padding:var(--space-8);">
          <h3 style="color:var(--rank-S);margin-bottom:var(--space-2);">Maximum Rank Achieved</h3>
          <p style="color:var(--color-text-muted);font-size:var(--text-sm);">You have reached the pinnacle. Continue growing beyond limits.</p>
        </div>
      `}

      ${rankHistory.length > 0 ? `
        <div class="section rank-history">
          <div class="section-title">Rank History</div>
          ${rankHistory.slice(0, 10).map(entry => `
            <div class="rank-history-item">
              <div class="rank-display rank-${entry.rank}" style="width:36px;height:36px;font-size:var(--text-base);border-radius:var(--radius-md);">${entry.rank}</div>
              <div style="flex:1;">
                <div style="font-family:var(--font-heading);font-size:var(--text-sm);">${entry.summary}</div>
                <div style="font-size:var(--text-xs);color:var(--color-text-muted);">${new Date(entry.timestamp).toLocaleDateString()}</div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}
