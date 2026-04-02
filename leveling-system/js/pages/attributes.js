// ============================================
// SOLO LEVELING SYSTEM — Attributes Page
// ============================================

import { state } from '../state.js';
import { attributeEngine } from '../engines/attribute-engine.js';

export async function renderAttributes(container) {
  const attributes = state.get('attributes') || [];
  const stats = attributeEngine.getStats(attributes);

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div class="page-subtitle">Player Stats</div>
        <h1 class="page-title">Attributes</h1>
      </div>

      <div class="stats-row" style="margin-bottom:var(--space-6);">
        <div class="stat-card">
          <div class="stat-value text-accent">${stats.totalXP}</div>
          <div class="stat-label">Total XP</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--color-accent-tertiary);">${stats.avgLevel}</div>
          <div class="stat-label">Avg Level</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--color-accent-success);">${attributes.length}</div>
          <div class="stat-label">Attributes</div>
        </div>
      </div>

      <div class="attributes-grid">
        ${attributes.map((attr, i) => {
          const level = attributeEngine.getLevel(attr.currentValue);
          const pct = attributeEngine.getLevelProgressPercent(attr.currentValue);
          const toNext = attributeEngine.getXPToNextLevel(attr.currentValue);
          const catColors = { physical: 'var(--color-accent-danger)', mental: 'var(--color-accent-primary)', social: 'var(--color-accent-warning)', skill: 'var(--color-accent-tertiary)', general: 'var(--color-text-secondary)' };
          const color = catColors[attr.category] || catColors.general;
          return `
            <div class="attribute-card" style="animation-delay:${i * 0.06}s;">
              <div class="attribute-header">
                <div class="attribute-name">${attr.name}</div>
                <div class="attribute-level" style="color:${color};">LV. ${level}</div>
              </div>
              <div class="progress">
                <div class="progress-fill" style="width:${pct}%;background:linear-gradient(90deg, ${color}, ${color}aa);"></div>
              </div>
              <div class="attribute-xp-text">
                ${attr.currentValue} XP total — ${toNext} XP to next level
              </div>
              <div style="margin-top:var(--space-2);">
                <span class="badge" style="background:${color}15;color:${color};border:1px solid ${color}30;font-size:0.6rem;">${(attr.category || 'general').toUpperCase()}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      ${attributes.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon" style="font-size:var(--text-3xl);opacity:0.3;">—</div>
          <div class="empty-state-title">No attributes yet</div>
          <p class="empty-state-text">Complete the setup to generate your attributes.</p>
        </div>
      ` : ''}
    </div>
  `;
}
