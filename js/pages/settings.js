// ============================================
// SOLO LEVELING SYSTEM — Settings Page
// ============================================

import { state } from '../state.js';
import { storage } from '../services/storage.js';
import { AIService } from '../services/ai.js';
import { CanvasService } from '../services/canvas.js';
import { taskEngine } from '../engines/task-engine.js';
import { showNotification } from '../components/notification.js';
import { showModal } from '../components/modal.js';
import { notificationService } from '../services/notifications.js';

export async function renderSettings(container) {
  const settings = state.get('settings') || {};
  const profile = state.get('profile');
  const canvasProxy = settings.canvasUseProxy !== false;
  const notifEnabled = notificationService.isEnabled();
  const notifSupported = 'Notification' in window;

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div class="page-subtitle">System Options</div>
        <h1 class="page-title">Settings</h1>
      </div>

      <div class="settings-group">
        <div class="settings-group-title" style="font-family:var(--font-heading);">AI Configuration</div>
        <div class="input-group">
          <label class="input-label">Gemini API Key</label>
          <div style="display:flex;gap:var(--space-2);">
            <input type="password" class="input" id="set-api-key" value="${settings.geminiApiKey || ''}" placeholder="AIza..." style="flex:1;" />
            <button class="btn btn-secondary btn-sm" id="test-gemini">Test</button>
          </div>
          <div class="input-hint">Get a free key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a></div>
          <div id="gemini-status"></div>
        </div>
        <button class="btn btn-secondary btn-sm" id="save-api">Save API Key</button>
      </div>

      <hr class="divider" />

      <div class="settings-group">
        <div class="settings-group-title" style="font-family:var(--font-heading);">Hours Per Day</div>
        <div class="input-group">
          <label class="input-label">Daily time budget</label>
          <div style="display:flex;align-items:center;gap:var(--space-4);">
            <input type="range" id="set-hours" min="1" max="12" step="0.5" value="${profile?.hoursPerDay || 3}"
              style="flex:1;accent-color:var(--color-accent-primary);height:6px;cursor:pointer;" />
            <span style="font-family:var(--font-heading);font-size:var(--text-xl);color:var(--color-accent-primary);min-width:48px;text-align:center;" id="hours-display">${profile?.hoursPerDay || 3}h</span>
          </div>
          <div class="input-hint">Tasks will be generated to fit within this time budget.</div>
        </div>
        <button class="btn btn-secondary btn-sm" id="save-hours">Save Hours</button>
      </div>

      <hr class="divider" />

      <div class="settings-group">
        <div class="settings-group-title" style="font-family:var(--font-heading);">Canvas LMS Integration</div>
        <div class="card" style="margin-bottom:var(--space-4);padding:var(--space-4);border-color:var(--color-border-primary);">
          <div style="font-family:var(--font-heading);font-size:var(--text-sm);letter-spacing:var(--tracking-wider);color:var(--color-accent-primary);margin-bottom:var(--space-3);">HOW TO SET UP CANVAS</div>
          <ol style="color:var(--color-text-secondary);font-size:var(--text-sm);line-height:1.8;padding-left:var(--space-5);">
            <li><strong>Find your Canvas domain</strong> — this is the URL you use to log in.
              <br/><span style="color:var(--color-text-muted);font-size:var(--text-xs);">Examples: <code style="background:var(--color-bg-tertiary);padding:2px 6px;border-radius:4px;">myschool.instructure.com</code> or <code style="background:var(--color-bg-tertiary);padding:2px 6px;border-radius:4px;">canvas.university.edu</code></span></li>
            <li><strong>Generate an API token</strong> — In Canvas, go to:
              <br/><span style="color:var(--color-accent-primary);">Account</span> &rarr; <span style="color:var(--color-accent-primary);">Settings</span> &rarr; scroll to <span style="color:var(--color-accent-primary);">Approved Integrations</span> &rarr; click <span style="color:var(--color-accent-primary);">+ New Access Token</span>
              <br/><span style="color:var(--color-text-muted);font-size:var(--text-xs);">Give it a name like "Solo Leveling System" and click Generate. Copy the token immediately.</span></li>
            <li><strong>Paste both below</strong> and click <strong>Test Connection</strong> to verify.</li>
          </ol>
        </div>
        <div class="input-group">
          <label class="input-label">Canvas Domain</label>
          <input type="text" class="input" id="set-canvas-domain" value="${settings.canvasDomain || ''}" placeholder="myschool.instructure.com" />
          <div class="input-hint">Just the domain, with or without https://</div>
        </div>
        <div class="input-group">
          <label class="input-label">Canvas API Token</label>
          <input type="password" class="input" id="set-canvas-token" value="${settings.canvasApiToken || ''}" placeholder="Paste your token here..." />
          <div class="input-hint">The long string from "New Access Token" in Canvas settings.</div>
        </div>
        <div class="settings-item" style="margin-bottom:var(--space-4);">
          <div class="settings-item-info">
            <div class="settings-item-label">Use CORS Proxy</div>
            <div class="settings-item-desc">Routes requests through a proxy to bypass browser security restrictions.</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="canvas-proxy-toggle" ${canvasProxy ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div id="canvas-status" style="margin-bottom:var(--space-3);"></div>
        <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" id="test-canvas">Test Connection</button>
          <button class="btn btn-secondary btn-sm" id="save-canvas">Save Settings</button>
          <button class="btn btn-primary btn-sm" id="sync-canvas" ${(!settings.canvasApiToken || !settings.canvasDomain) ? 'disabled' : ''}>Import Assignments</button>
        </div>
      </div>

      <hr class="divider" />

      <div class="settings-group">
        <div class="settings-group-title" style="font-family:var(--font-heading);">Notifications</div>
        <div class="settings-item" style="margin-bottom:var(--space-3);">
          <div class="settings-item-info">
            <div class="settings-item-label">Push Notifications</div>
            <div class="settings-item-desc">${notifSupported ? (notifEnabled ? 'Enabled — you will receive assignment reminders' : 'Receive reminders 7 days, 3 days, and 1 day before deadlines') : 'Not supported in this browser'}</div>
          </div>
          ${notifSupported ? `
            <button class="btn ${notifEnabled ? 'btn-ghost' : 'btn-primary'} btn-sm" id="toggle-notifications">
              ${notifEnabled ? 'Enabled' : 'Enable'}
            </button>
          ` : ''}
        </div>
        ${notifEnabled ? `
          <div style="font-size:var(--text-xs);color:var(--color-text-muted);padding:0 var(--space-2);">
            Reminders are sent at: 7 days, 3 days, and 1 day before each assignment deadline.
            Daily quest reminders at 8 AM and 8 PM.
          </div>
        ` : ''}
      </div>

      <hr class="divider" />

      <div class="settings-group">
        <div class="settings-group-title" style="font-family:var(--font-heading);">Data Management</div>
        <div style="display:flex;flex-direction:column;gap:var(--space-3);">
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-label">Export Data</div>
              <div class="settings-item-desc">Download a JSON backup of all your data</div>
            </div>
            <button class="btn btn-secondary btn-sm" id="export-data">Export</button>
          </div>
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-label">Import Data</div>
              <div class="settings-item-desc">Restore from a previously exported backup</div>
            </div>
            <button class="btn btn-secondary btn-sm" id="import-data">Import</button>
            <input type="file" id="import-file" accept=".json" style="display:none;" />
          </div>
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-label">Reset All Data</div>
              <div class="settings-item-desc">Delete everything and start fresh</div>
            </div>
            <button class="btn btn-danger btn-sm" id="reset-data">Reset</button>
          </div>
        </div>
      </div>

      <hr class="divider" />

      <div class="settings-group" style="text-align:center;padding:var(--space-4);">
        <p style="color:var(--color-text-muted);font-size:var(--text-sm);font-family:var(--font-heading);letter-spacing:var(--tracking-wider);">
          SOLO LEVELING SYSTEM v1.0
        </p>
        <p style="color:var(--color-text-muted);font-size:var(--text-xs);margin-top:var(--space-1);">
          All data stored locally. No servers. No tracking.
        </p>
      </div>
    </div>
  `;

  // Notification toggle
  container.querySelector('#toggle-notifications')?.addEventListener('click', async () => {
    const result = await notificationService.requestPermission();
    if (result.granted) {
      showNotification('Notifications enabled. You will receive deadline reminders.', 'success');
      await notificationService.checkAndNotify();
    } else {
      showNotification(result.reason || 'Unable to enable notifications.', 'warning');
    }
    renderSettings(container);
  });

  // Hours slider
  const hoursSlider = container.querySelector('#set-hours');
  const hoursDisplay = container.querySelector('#hours-display');
  if (hoursSlider && hoursDisplay) {
    hoursSlider.addEventListener('input', () => {
      hoursDisplay.textContent = hoursSlider.value + 'h';
    });
  }

  // Save hours
  container.querySelector('#save-hours')?.addEventListener('click', async () => {
    const p = await storage.get('profile', 'player');
    if (p) {
      p.hoursPerDay = parseFloat(container.querySelector('#set-hours').value) || 3;
      await storage.put('profile', p);
      state.set('profile', p);
      showNotification('Hours per day updated.', 'success');
    }
  });

  // Gemini test
  container.querySelector('#test-gemini')?.addEventListener('click', async () => {
    const key = container.querySelector('#set-api-key').value.trim();
    const el = container.querySelector('#gemini-status');
    if (!key) { el.innerHTML = '<span class="text-danger" style="font-size:0.8rem;">Enter a key first</span>'; return; }
    el.innerHTML = '<span class="text-accent" style="font-size:0.8rem;">Testing...</span>';
    const ai = new AIService(key);
    const r = await ai.testConnection();
    el.innerHTML = r.success
      ? '<span class="text-success" style="font-size:0.8rem;">Connected to Gemini</span>'
      : `<span class="text-danger" style="font-size:0.8rem;">${r.error}</span>`;
  });

  // Save API
  container.querySelector('#save-api')?.addEventListener('click', async () => {
    const s = await storage.get('settings', 'main') || { id: 'main' };
    s.geminiApiKey = container.querySelector('#set-api-key').value.trim();
    await storage.put('settings', s);
    state.set('settings', s);
    showNotification('API key saved.', 'success');
  });

  // Canvas test
  container.querySelector('#test-canvas')?.addEventListener('click', async () => {
    const domain = container.querySelector('#set-canvas-domain').value.trim();
    const token = container.querySelector('#set-canvas-token').value.trim();
    const useProxy = container.querySelector('#canvas-proxy-toggle').checked;
    const el = container.querySelector('#canvas-status');
    if (!domain) { el.innerHTML = '<span class="text-danger" style="font-size:0.8rem;">Enter your Canvas domain</span>'; return; }
    if (!token) { el.innerHTML = '<span class="text-danger" style="font-size:0.8rem;">Enter your Canvas API token</span>'; return; }
    el.innerHTML = '<span class="text-accent" style="font-size:0.8rem;">Connecting to Canvas...</span>';
    const canvas = new CanvasService(token, domain, useProxy);
    const r = await canvas.testConnection();
    if (r.success) {
      el.innerHTML = `<span class="text-success" style="font-size:0.8rem;">${r.message}</span>`;
    } else {
      const errorHtml = r.error.replace(/\n/g, '<br/>');
      el.innerHTML = `<div class="text-danger" style="font-size:0.8rem;line-height:1.6;">${errorHtml}</div>`;
    }
  });

  // Save Canvas
  container.querySelector('#save-canvas')?.addEventListener('click', async () => {
    const s = await storage.get('settings', 'main') || { id: 'main' };
    s.canvasDomain = container.querySelector('#set-canvas-domain').value.trim();
    s.canvasApiToken = container.querySelector('#set-canvas-token').value.trim();
    s.canvasUseProxy = container.querySelector('#canvas-proxy-toggle').checked;
    await storage.put('settings', s);
    state.set('settings', s);
    showNotification('Canvas settings saved.', 'success');
    const syncBtn = container.querySelector('#sync-canvas');
    if (syncBtn && s.canvasApiToken && s.canvasDomain) syncBtn.disabled = false;
  });

  // Sync Canvas
  container.querySelector('#sync-canvas')?.addEventListener('click', async () => {
    const s = state.get('settings') || {};
    const syncBtn = container.querySelector('#sync-canvas');
    const el = container.querySelector('#canvas-status');
    if (!s.canvasDomain || !s.canvasApiToken) { showNotification('Save your Canvas settings first.', 'warning'); return; }
    syncBtn.disabled = true;
    syncBtn.textContent = 'Syncing...';
    el.innerHTML = '<span class="text-accent" style="font-size:0.8rem;">Fetching assignments...</span>';
    try {
      const useProxy = s.canvasUseProxy !== false;
      const canvas = new CanvasService(s.canvasApiToken, s.canvasDomain, useProxy);
      const rawAssignments = await canvas.getUpcomingAssignments();
      if (rawAssignments.length === 0) {
        el.innerHTML = '<span class="text-warning" style="font-size:0.8rem;">No upcoming assignments found in the next 14 days.</span>';
      } else {
        // Convert to assignment objects
        const assignments = canvas.convertToAssignments(rawAssignments);

        // Preserve progress for existing assignments
        const existing = await storage.getAll('canvasAssignments');
        const existingMap = {};
        existing.forEach(a => { existingMap[a.canvasId] = a; });
        for (const a of assignments) {
          const old = existingMap[a.canvasId];
          if (old) {
            a.progress = old.progress;
            a.status = old.status;
            a.aiDifficulty = old.aiDifficulty;
            a.aiDifficultyReason = old.aiDifficultyReason;
          }
        }

        // Store in canvasAssignments
        await storage.putMany('canvasAssignments', assignments);

        el.innerHTML = `<span class="text-success" style="font-size:0.8rem;">Imported ${assignments.length} assignment${assignments.length !== 1 ? 's' : ''}</span>`;
        showNotification(`Imported ${assignments.length} Canvas assignments.`, 'success');

        // Run AI difficulty assessment if Gemini key available
        const needsAssessment = assignments.filter(a => !a.aiDifficulty);
        if (needsAssessment.length > 0 && s.geminiApiKey) {
          el.innerHTML = '<span class="text-accent" style="font-size:0.8rem;">Assessing difficulty with AI...</span>';
          try {
            const ai = new AIService(s.geminiApiKey);
            const result = await ai.assessAssignmentDifficulty(needsAssessment);
            if (result.assessments) {
              for (const assessment of result.assessments) {
                const match = assignments.find(a => a.id === assessment.id || a.canvasId === assessment.id);
                if (match) {
                  match.aiDifficulty = assessment.difficulty;
                  match.aiDifficultyReason = assessment.reason;
                  await storage.put('canvasAssignments', match);
                }
              }
              el.innerHTML = `<span class="text-success" style="font-size:0.8rem;">Imported ${assignments.length} assignments with AI difficulty assessment</span>`;
            }
          } catch (aiErr) {
            console.warn('AI difficulty assessment failed:', aiErr);
            el.innerHTML += '<br/><span class="text-warning" style="font-size:0.75rem;">AI difficulty assessment skipped</span>';
          }
        }

        // Schedule notifications for imported assignments
        await notificationService.checkAndNotify();
      }
    } catch (e) {
      const errorHtml = e.message.replace(/\n/g, '<br/>');
      el.innerHTML = `<div class="text-danger" style="font-size:0.8rem;line-height:1.6;">${errorHtml}</div>`;
      showNotification('Canvas sync failed.', 'error');
    }
    syncBtn.disabled = false;
    syncBtn.textContent = 'Import Assignments';
  });

  // Export
  container.querySelector('#export-data')?.addEventListener('click', async () => {
    const data = await storage.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `solo-leveling-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click(); URL.revokeObjectURL(url);
    showNotification('Data exported.', 'success');
  });

  // Import
  container.querySelector('#import-data')?.addEventListener('click', () => { container.querySelector('#import-file').click(); });
  container.querySelector('#import-file')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    showModal({
      title: 'Import Data?',
      body: 'This will replace all current data with the backup. This cannot be undone.',
      confirmText: 'Import',
      onConfirm: async () => {
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          await storage.importAll(data);
          showNotification('Data imported. Reloading...', 'success');
          setTimeout(() => window.location.reload(), 1000);
        } catch (err) {
          showNotification('Invalid backup file.', 'error');
        }
      },
    });
  });

  // Reset
  container.querySelector('#reset-data')?.addEventListener('click', () => {
    showModal({
      title: 'Reset All Data?',
      body: 'This will permanently delete all your progress, attributes, rank history, and settings. This cannot be undone.',
      confirmText: 'Reset Everything',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        await storage.resetAll();
        showNotification('All data deleted.', 'warning');
        setTimeout(() => { window.location.hash = '/setup'; window.location.reload(); }, 800);
      },
    });
  });
}
