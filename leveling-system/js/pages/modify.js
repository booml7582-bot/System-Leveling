// ============================================
// SOLO LEVELING SYSTEM — Modify System Page
// ============================================

import { state } from '../state.js';
import { storage } from '../services/storage.js';
import { attributeEngine } from '../engines/attribute-engine.js';
import { showNotification } from '../components/notification.js';
import { showModal } from '../components/modal.js';

export async function renderModify(container) {
  const profile = state.get('profile');
  const attributes = state.get('attributes') || [];
  const settings = state.get('settings');
  if (!profile) { window.location.hash = '/setup'; return; }

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div class="page-subtitle">System Configuration</div>
        <h1 class="page-title">Modify System</h1>
      </div>

      <div class="modify-warning">
        <span style="font-size:var(--text-sm);font-weight:600;">NOTE</span>
        <span>Changes here will modify your System. Existing progress and rank history will be preserved.</span>
      </div>

      <div class="modify-section">
        <div class="modify-section-title">Goals</div>
        <div class="input-group">
          <label class="input-label">Who do you want to become?</label>
          <textarea class="input textarea" id="mod-goal" rows="3">${profile.goalIdentity || ''}</textarea>
        </div>
        <div class="input-group">
          <label class="input-label">Why?</label>
          <textarea class="input textarea" id="mod-reason" rows="2">${profile.goalReason || ''}</textarea>
        </div>
        <div class="input-group">
          <label class="input-label">Actions</label>
          <textarea class="input textarea" id="mod-actions" rows="2">${profile.goalActions || ''}</textarea>
        </div>
        <button class="btn btn-secondary" id="save-goals">Save Goals</button>
      </div>

      <hr class="divider" />

      <div class="modify-section">
        <div class="modify-section-title">Attributes</div>
        <div style="display:flex;flex-direction:column;gap:var(--space-3);margin-bottom:var(--space-4);">
          ${attributes.map(attr => `
            <div class="card" style="padding:var(--space-3) var(--space-4);display:flex;align-items:center;gap:var(--space-3);">
              <div style="flex:1;">
                <div style="font-family:var(--font-heading);font-size:var(--text-sm);">${attr.name}</div>
                <div style="font-size:var(--text-xs);color:var(--color-text-muted);">XP: ${attr.currentValue} / ${attr.category}</div>
              </div>
              <button class="btn btn-ghost btn-sm" data-remove-attr="${attr.id}" title="Remove">x</button>
            </div>
          `).join('')}
        </div>
        <div style="display:flex;gap:var(--space-2);">
          <input type="text" class="input" id="new-attr-name" placeholder="New attribute name" style="flex:1;" />
          <button class="btn btn-secondary btn-sm" id="add-attr">Add</button>
        </div>
      </div>

      <hr class="divider" />

      <div class="modify-section">
        <div class="modify-section-title">Difficulty and Interval</div>
        <div class="input-group">
          <label class="input-label">Difficulty</label>
          <select class="input select" id="mod-difficulty">
            <option value="easy" ${settings?.difficulty === 'easy' ? 'selected' : ''}>Easy — Fewer tasks, lower XP</option>
            <option value="medium" ${settings?.difficulty === 'medium' ? 'selected' : ''}>Medium — Balanced</option>
            <option value="hard" ${settings?.difficulty === 'hard' ? 'selected' : ''}>Hard — More tasks, higher XP</option>
          </select>
        </div>
        <div class="input-group">
          <label class="input-label">Re-evaluation Interval</label>
          <select class="input select" id="mod-interval">
            <option value="7" ${profile.reEvalIntervalDays == 7 ? 'selected' : ''}>Weekly (7 days)</option>
            <option value="14" ${profile.reEvalIntervalDays == 14 ? 'selected' : ''}>Bi-weekly (14 days)</option>
            <option value="30" ${profile.reEvalIntervalDays == 30 ? 'selected' : ''}>Monthly (30 days)</option>
          </select>
        </div>
        <button class="btn btn-secondary" id="save-settings-mod">Save Settings</button>
      </div>

      <hr class="divider" />

      <div style="text-align:center;padding:var(--space-4);">
        <a href="#/settings" class="btn btn-ghost btn-sm">Open Advanced Settings</a>
      </div>
    </div>
  `;

  container.querySelector('#save-goals')?.addEventListener('click', async () => {
    const p = await storage.get('profile', 'player');
    p.goalIdentity = container.querySelector('#mod-goal').value;
    p.goalReason = container.querySelector('#mod-reason').value;
    p.goalActions = container.querySelector('#mod-actions').value;
    await storage.put('profile', p);
    state.set('profile', p);
    showNotification('Goals updated.', 'success');
  });

  container.querySelector('#save-settings-mod')?.addEventListener('click', async () => {
    const p = await storage.get('profile', 'player');
    const s = await storage.get('settings', 'main') || { id: 'main' };
    p.reEvalIntervalDays = parseInt(container.querySelector('#mod-interval').value);
    p.nextReEvalAt = new Date(Date.now() + p.reEvalIntervalDays * 86400000).toISOString();
    s.difficulty = container.querySelector('#mod-difficulty').value;
    await storage.put('profile', p);
    await storage.put('settings', s);
    state.set('profile', p);
    state.set('settings', s);
    showNotification('Settings saved.', 'success');
  });

  container.querySelector('#add-attr')?.addEventListener('click', async () => {
    const name = container.querySelector('#new-attr-name').value.trim();
    if (!name) return;
    await attributeEngine.addAttribute(name, '', 'general');
    showNotification(`Attribute "${name}" added.`, 'success');
    renderModify(container);
  });

  container.querySelectorAll('[data-remove-attr]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.removeAttr;
      const attr = attributes.find(a => a.id === id);
      showModal({
        title: 'Remove Attribute?',
        body: `Remove "${attr?.name}"? Its XP will be lost.`,
        confirmText: 'Remove',
        confirmClass: 'btn-danger',
        onConfirm: async () => {
          await attributeEngine.removeAttribute(id);
          showNotification(`Attribute "${attr?.name}" removed.`, 'warning');
          renderModify(container);
        },
      });
    });
  });
}
