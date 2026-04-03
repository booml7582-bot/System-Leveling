// ============================================
// SOLO LEVELING SYSTEM — Dashboard Page
// ============================================

import { state } from '../state.js';
import { storage, generateId } from '../services/storage.js';
import { taskEngine } from '../engines/task-engine.js';
import { attributeEngine } from '../engines/attribute-engine.js';
import { reEvalEngine } from '../engines/reeval-engine.js';
import { showNotification } from '../components/notification.js';
import { notificationService } from '../services/notifications.js';

// --- Refresh tracking (2x per day max) ---
const REFRESH_KEY = 'sls_refresh_count';

function getRefreshCount() {
  try {
    const data = JSON.parse(localStorage.getItem(REFRESH_KEY) || '{}');
    const today = new Date().toISOString().split('T')[0];
    return data.date === today ? data.count : 0;
  } catch { return 0; }
}

function incrementRefresh() {
  const today = new Date().toISOString().split('T')[0];
  const count = getRefreshCount() + 1;
  localStorage.setItem(REFRESH_KEY, JSON.stringify({ date: today, count }));
  return count;
}

// SVG icon helpers
const ICON = {
  link: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  plus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  trash: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`,
};

export async function renderDashboard(container) {
  const profile = state.get('profile');
  const tasks = state.get('tasks') || [];
  const attributes = state.get('attributes') || [];
  if (!profile) { window.location.hash = '/setup'; return; }

  const name = profile.playerName || 'Player';
  const todayTasks = taskEngine.getTodaysTasks(tasks);
  const stats = taskEngine.getCompletionStats(tasks);
  const streak = await taskEngine.getStreak();
  const daysActive = Math.max(1, Math.ceil((Date.now() - new Date(profile.createdAt).getTime()) / 86400000));
  const reEvalTime = reEvalEngine.getTimeRemaining(profile);
  const todayXP = todayTasks.filter(t => t.status === 'completed').reduce((s, t) => s + taskEngine.getTaskXP(t), 0);
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Load all assignments (canvas + manual)
  const allAssignments = await storage.getAll('canvasAssignments');
  const activeAssignments = allAssignments
    .filter(a => a.status === 'active' && new Date(a.dueDate) > new Date(Date.now() - 86400000))
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  container.innerHTML = `
    <div class="page">
      <div class="dashboard-header">
        <div>
          <div class="dashboard-day">Day ${daysActive}</div>
          <div class="dashboard-date">${dateStr}</div>
        </div>
        <div class="rank-display rank-${profile.currentRank}" title="${profile.currentRank}-Rank">
          ${profile.currentRank}
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value text-accent">${stats.completed}/${stats.total}</div>
          <div class="stat-label">Tasks Done</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: var(--color-accent-success);">+${todayXP}</div>
          <div class="stat-label">XP Today</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: var(--color-accent-warning);">${streak}</div>
          <div class="stat-label">Streak</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: var(--color-accent-tertiary);">${reEvalTime.days}d</div>
          <div class="stat-label">Re-Eval</div>
        </div>
      </div>

      <div class="system-message" id="system-msg">
        <div class="system-message-label">SYSTEM</div>
        <div class="system-message-text" id="sys-msg-text">
          ${getSystemMessage(stats, streak, daysActive, name)}
        </div>
      </div>

      <div class="section">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div class="section-title" style="margin-bottom:0;">Daily Quests</div>
          ${todayTasks.length > 0 ? (() => {
            const used = getRefreshCount();
            const remaining = Math.max(0, 2 - used);
            const disabled = remaining <= 0;
            return `<button class="btn btn-ghost btn-sm" id="refresh-tasks" ${disabled ? 'disabled' : ''}
              style="font-size:var(--text-xs);opacity:${disabled ? '0.35' : '0.7'};" title="${disabled ? 'No refreshes remaining today' : remaining + ' refresh' + (remaining !== 1 ? 'es' : '') + ' remaining today'}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
              Refresh (${remaining}/2)
            </button>`;
          })() : ''}
        </div>
        ${todayTasks.length > 0 ? `
          <div class="task-list" id="task-list">
            ${todayTasks.map((task, i) => renderTaskCard(task, i)).join('')}
          </div>
        ` : `
          <div class="empty-state">
            <div class="empty-state-icon" style="font-size:var(--text-3xl);opacity:0.3;">—</div>
            <div class="empty-state-title">No quests today</div>
            <button class="btn btn-primary" id="generate-tasks" style="margin-top:var(--space-4);">Generate Today's Quests</button>
          </div>
        `}
      </div>

      <div class="section">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div class="section-title" style="margin-bottom:0;">Assignments</div>
          <button class="btn btn-ghost btn-sm" id="add-assignment-btn" style="font-size:var(--text-xs);opacity:0.7;">
            ${ICON.plus}
            <span style="margin-left:4px;">Add</span>
          </button>
        </div>
        ${activeAssignments.length > 0 ? `
          <div class="assignment-list" id="assignment-list">
            ${activeAssignments.map((a, i) => renderAssignmentCard(a, i)).join('')}
          </div>
        ` : `
          <div class="empty-state" style="padding:var(--space-6);">
            <div style="font-size:var(--text-sm);color:var(--color-text-muted);margin-bottom:var(--space-3);">No active assignments</div>
            <div style="font-size:var(--text-xs);color:var(--color-text-muted);">Import from Canvas in Settings or add one manually.</div>
          </div>
        `}
      </div>

      ${attributes.length > 0 ? `
        <div class="section">
          <div class="section-title">Attributes</div>
          <div style="display:flex;flex-direction:column;gap:var(--space-3);">
            ${attributes.slice(0, 4).map(attr => {
              const level = attributeEngine.getLevel(attr.currentValue);
              const progress = attributeEngine.getLevelProgressPercent(attr.currentValue);
              return `
                <div style="display:flex;align-items:center;gap:var(--space-3);">
                  <div style="flex:1;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                      <span style="font-size:var(--text-sm);font-family:var(--font-heading);">${attr.name}</span>
                      <span style="font-size:var(--text-xs);color:var(--color-text-muted);">Lv.${level}</span>
                    </div>
                    <div class="progress progress-sm">
                      <div class="progress-fill" style="width:${progress}%;"></div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  bindDashboardEvents(container);
}

// ── Assignment Card ──
function renderAssignmentCard(assignment, index) {
  const due = new Date(assignment.dueDate);
  const now = new Date();
  const daysLeft = Math.max(0, Math.ceil((due - now) / 86400000));
  const isUrgent = daysLeft <= 1;
  const isClose = daysLeft <= 3;

  const dateStr = due.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = due.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const diff = assignment.aiDifficulty || assignment.difficulty || 'medium';
  const diffColors = {
    easy: 'var(--color-accent-success)',
    medium: 'var(--color-accent-warning)',
    hard: 'var(--color-accent-danger)',
    expert: 'var(--color-accent-tertiary)',
  };
  const diffColor = diffColors[diff] || diffColors.medium;

  const urgencyColor = isUrgent ? 'var(--color-accent-danger)' : isClose ? 'var(--color-accent-warning)' : 'var(--color-text-muted)';
  const urgencyLabel = isUrgent ? 'Due today' : daysLeft === 1 ? 'Due tomorrow' : `${daysLeft} days left`;

  const hasLink = assignment.htmlUrl;
  const isManual = assignment.isManual;

  return `
    <div class="card assignment-card" style="padding:var(--space-4);margin-bottom:var(--space-3);animation-delay:${index * 0.05}s;" data-assignment-id="${assignment.id}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-2);">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:2px;">
            <span style="font-family:var(--font-heading);font-size:var(--text-sm);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${assignment.title}
            </span>
            ${hasLink ? `
              <a href="${assignment.htmlUrl}" target="_blank" rel="noopener noreferrer"
                 style="flex-shrink:0;color:var(--color-accent-primary);opacity:0.6;transition:opacity 0.2s;"
                 onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'"
                 title="Open in Canvas">
                ${ICON.link}
              </a>
            ` : ''}
            ${isManual ? `
              <button class="assignment-delete-btn" data-delete-id="${assignment.id}"
                style="flex-shrink:0;background:none;border:none;color:var(--color-text-muted);opacity:0.4;cursor:pointer;padding:2px;transition:opacity 0.2s;display:flex;"
                onmouseover="this.style.opacity='0.9';this.style.color='var(--color-accent-danger)'"
                onmouseout="this.style.opacity='0.4';this.style.color='var(--color-text-muted)'"
                title="Delete assignment">
                ${ICON.trash}
              </button>
            ` : ''}
          </div>
          <div style="font-size:var(--text-xs);color:var(--color-text-muted);">${assignment.courseName || ''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:var(--space-3);">
          <div style="font-size:var(--text-xs);color:${urgencyColor};font-family:var(--font-heading);font-weight:600;">${urgencyLabel}</div>
          <div style="font-size:var(--text-xs);color:var(--color-text-muted);">${dateStr}, ${timeStr}</div>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-3);">
        <span class="badge" style="background:${diffColor}15;color:${diffColor};border:1px solid ${diffColor}30;font-size:0.6rem;text-transform:uppercase;">${diff}</span>
        ${assignment.pointsPossible ? `<span style="font-size:var(--text-xs);color:var(--color-text-muted);">${assignment.pointsPossible} pts</span>` : ''}
        ${assignment.aiDifficultyReason ? `<span style="font-size:var(--text-xs);color:var(--color-text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${assignment.aiDifficultyReason}">${assignment.aiDifficultyReason}</span>` : ''}
      </div>

      <div style="display:flex;align-items:center;gap:var(--space-3);">
        <span style="font-size:var(--text-xs);color:var(--color-text-muted);width:56px;flex-shrink:0;">Progress</span>
        <input type="range" class="assignment-progress-slider" data-id="${assignment.id}" min="0" max="100" step="5" value="${assignment.progress || 0}"
          style="flex:1;accent-color:var(--color-accent-primary);height:4px;cursor:pointer;" />
        <span class="assignment-progress-value" data-id="${assignment.id}" style="font-family:var(--font-heading);font-size:var(--text-sm);color:var(--color-accent-primary);width:40px;text-align:right;">${assignment.progress || 0}%</span>
      </div>
    </div>
  `;
}

function renderTaskCard(task, index) {
  const isComplete = task.status === 'completed';
  const totalXP = taskEngine.getTaskXP(task);
  const diffColor = { easy: 'var(--color-accent-success)', medium: 'var(--color-accent-warning)', hard: 'var(--color-accent-danger)' };
  return `
    <div class="task-card ${isComplete ? 'completed' : ''}" style="animation-delay:${index * 0.05}s;position:relative;" data-task-id="${task.id}">
      <div class="task-checkbox ${isComplete ? 'checked' : ''}" data-task-id="${task.id}" id="checkbox-${task.id}"></div>
      <div class="task-content">
        <div class="task-title">${task.title}</div>
        ${task.description ? `<div class="task-desc">${task.description}</div>` : ''}
        <div class="task-meta">
          ${task.durationMinutes ? `<span class="task-time">${task.durationMinutes}m</span>` : ''}
          <span class="badge badge-accent" style="font-size:0.65rem;">+${totalXP} XP</span>
          ${task.difficulty ? `<span style="font-size:0.65rem;color:${diffColor[task.difficulty] || 'inherit'};">${task.difficulty}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function getSystemMessage(stats, streak, daysActive, name) {
  if (daysActive === 1) return `Welcome, ${name}. The System has been activated. Complete your daily quests to grow stronger.`;
  if (stats.rate === 100) return 'All daily quests completed. Your dedication fuels your growth.';
  if (stats.rate >= 75) return 'Strong progress today. Maintain this momentum to accelerate your evolution.';
  if (streak >= 7) return `${streak}-day streak. Consistency is the mark of the strong. Keep moving forward.`;
  if (stats.rate >= 50) return 'You are making progress. Push further — the System demands excellence.';
  if (stats.completed === 0 && stats.total > 0) return `Your quests await, ${name}. Each completed task brings you closer to your goal.`;
  return 'The path to strength is paved with daily effort. Begin your quests.';
}

// ── Add Assignment Modal ──
function showAddAssignmentModal(container) {
  // Set default deadline to 7 days from now
  const defaultDate = new Date(Date.now() + 7 * 86400000);
  const defaultDateStr = defaultDate.toISOString().slice(0, 16);

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'add-assignment-modal';
  backdrop.innerHTML = `
    <div class="modal" style="max-width:440px;">
      <h3 class="modal-title">Add Assignment</h3>
      <div class="modal-body" style="margin-bottom:var(--space-4);">
        <div class="input-group" style="margin-bottom:var(--space-4);">
          <label class="input-label">Assignment Name</label>
          <input type="text" class="input" id="new-assign-name" placeholder="e.g. Research Paper Draft" autofocus />
        </div>
        <div class="input-group" style="margin-bottom:var(--space-4);">
          <label class="input-label">Course / Category (optional)</label>
          <input type="text" class="input" id="new-assign-course" placeholder="e.g. CS 101, Personal Project" />
        </div>
        <div class="input-group" style="margin-bottom:var(--space-4);">
          <label class="input-label">Deadline</label>
          <input type="datetime-local" class="input" id="new-assign-deadline" value="${defaultDateStr}" />
        </div>
        <div class="input-group" style="margin-bottom:var(--space-4);">
          <label class="input-label">Difficulty</label>
          <select class="input select" id="new-assign-difficulty">
            <option value="easy">Easy</option>
            <option value="medium" selected>Medium</option>
            <option value="hard">Hard</option>
            <option value="expert">Expert</option>
          </select>
        </div>
        <div class="input-group" style="margin-bottom:var(--space-4);">
          <label class="input-label">Link (optional)</label>
          <input type="url" class="input" id="new-assign-link" placeholder="https://..." />
        </div>
        <div class="input-group">
          <label class="input-label">Notes (optional)</label>
          <textarea class="input textarea" id="new-assign-notes" rows="2" placeholder="Any details about this assignment..."></textarea>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="modal-confirm">Add Assignment</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  // Close on backdrop click
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });

  backdrop.querySelector('#modal-cancel').addEventListener('click', () => backdrop.remove());

  backdrop.querySelector('#modal-confirm').addEventListener('click', async () => {
    const name = backdrop.querySelector('#new-assign-name').value.trim();
    const course = backdrop.querySelector('#new-assign-course').value.trim();
    const deadline = backdrop.querySelector('#new-assign-deadline').value;
    const difficulty = backdrop.querySelector('#new-assign-difficulty').value;
    const link = backdrop.querySelector('#new-assign-link').value.trim();
    const notes = backdrop.querySelector('#new-assign-notes').value.trim();

    if (!name) {
      backdrop.querySelector('#new-assign-name').style.borderColor = 'var(--color-accent-danger)';
      return;
    }
    if (!deadline) {
      backdrop.querySelector('#new-assign-deadline').style.borderColor = 'var(--color-accent-danger)';
      return;
    }

    const assignment = {
      id: `manual_${generateId()}`,
      canvasId: null,
      title: name,
      courseName: course || 'Manual',
      courseId: '',
      description: notes,
      dueDate: new Date(deadline).toISOString(),
      pointsPossible: 0,
      submissionTypes: [],
      htmlUrl: link || '',
      difficulty: difficulty,
      progress: 0,
      status: 'active',
      importedAt: new Date().toISOString(),
      aiDifficulty: null,
      aiDifficultyReason: null,
      isManual: true,
    };

    await storage.put('canvasAssignments', assignment);
    backdrop.remove();
    showNotification(`Assignment "${name}" added.`, 'success');

    // Schedule notifications for this assignment
    await notificationService.scheduleForAssignment(assignment);

    // Request notification permission if not yet granted
    if (!notificationService.isEnabled()) {
      const result = await notificationService.requestPermission();
      if (result.granted) {
        showNotification('Notifications enabled. You will receive reminders for upcoming deadlines.', 'system');
      }
    }

    renderDashboard(container);
  });

  // ESC key
  const escHandler = (e) => {
    if (e.key === 'Escape') { backdrop.remove(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);
}

// ── Event Bindings ──
function bindDashboardEvents(container) {
  // Task checkboxes
  container.querySelectorAll('.task-checkbox').forEach(cb => {
    cb.addEventListener('click', async () => {
      const taskId = cb.dataset.taskId;
      const tasks = state.get('tasks') || [];
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      if (task.status === 'completed') {
        await taskEngine.uncompleteTask(taskId);
      } else {
        const completed = await taskEngine.completeTask(taskId);
        if (completed) {
          const results = await attributeEngine.processTaskRewards(completed);
          const totalXP = results.reduce((s, r) => s + r.xpGained, 0);

          const card = container.querySelector(`[data-task-id="${taskId}"].task-card`);
          if (card) {
            const popup = document.createElement('div');
            popup.className = 'xp-popup';
            popup.textContent = `+${totalXP} XP`;
            popup.style.right = '16px';
            popup.style.top = '16px';
            card.appendChild(popup);
            setTimeout(() => popup.remove(), 1100);
          }

          results.filter(r => r.leveledUp).forEach(r => {
            showNotification(`${r.attribute.name} reached Level ${r.newLevel}`, 'success');
          });

          await taskEngine.logDay();
        }
      }
      renderDashboard(container);
    });
  });

  // Assignment progress sliders
  container.querySelectorAll('.assignment-progress-slider').forEach(slider => {
    const valueEl = container.querySelector(`.assignment-progress-value[data-id="${slider.dataset.id}"]`);
    slider.addEventListener('input', () => {
      if (valueEl) valueEl.textContent = slider.value + '%';
    });
    slider.addEventListener('change', async () => {
      const id = slider.dataset.id;
      const progress = parseInt(slider.value);
      const assignment = await storage.get('canvasAssignments', id);
      if (assignment) {
        assignment.progress = progress;
        if (progress >= 100) assignment.status = 'completed';
        else assignment.status = 'active';
        await storage.put('canvasAssignments', assignment);
      }
    });
  });

  // Delete assignment buttons (manual only)
  container.querySelectorAll('.assignment-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.deleteId;
      const assignment = await storage.get('canvasAssignments', id);
      if (!assignment) return;

      // Simple confirm
      const { showModal } = await import('../components/modal.js');
      showModal({
        title: 'Delete Assignment?',
        body: `Remove "${assignment.title}"? This cannot be undone.`,
        confirmText: 'Delete',
        confirmClass: 'btn-danger',
        onConfirm: async () => {
          await storage.delete('canvasAssignments', id);
          showNotification(`Assignment "${assignment.title}" removed.`, 'warning');
          renderDashboard(container);
        },
      });
    });
  });

  // Add assignment button
  container.querySelector('#add-assignment-btn')?.addEventListener('click', () => {
    showAddAssignmentModal(container);
  });

  // Generate tasks button
  const genBtn = container.querySelector('#generate-tasks');
  if (genBtn) {
    genBtn.addEventListener('click', async () => {
      genBtn.disabled = true;
      genBtn.textContent = 'Generating...';
      try {
        const settings = state.get('settings');
        const profile = state.get('profile');
        const attributes = state.get('attributes') || [];
        const history = await taskEngine.getCompletionHistory();
        if (settings?.geminiApiKey) {
          const { AIService } = await import('../services/ai.js');
          const ai = new AIService(settings.geminiApiKey);
          const result = await ai.generateDailyTasks(profile, attributes, history);
          await taskEngine.createTasks(result.dailyTasks);
          if (result.systemMessage) showNotification(result.systemMessage, 'system');
        } else {
          const { AIService } = await import('../services/ai.js');
          const fallback = AIService.getFallbackSetup(profile);
          await taskEngine.createTasks(fallback.dailyTasks);
        }
        renderDashboard(container);
      } catch (e) {
        console.error('Task generation error:', e);
        showNotification('Failed to generate tasks: ' + e.message, 'error');
        genBtn.disabled = false;
        genBtn.textContent = 'Generate Today\'s Quests';
      }
    });
  }

  // Refresh tasks button
  const refreshBtn = container.querySelector('#refresh-tasks');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      if (getRefreshCount() >= 2) {
        showNotification('No refreshes remaining today.', 'warning');
        return;
      }
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Refreshing...';
      try {
        const tasks = state.get('tasks') || [];
        const today = new Date().toISOString().split('T')[0];
        const todayTaskIds = tasks.filter(t => t.dueDate && t.dueDate.startsWith(today)).map(t => t.id);
        for (const id of todayTaskIds) {
          await storage.delete('tasks', id);
        }
        const remaining = tasks.filter(t => !todayTaskIds.includes(t.id));
        state.set('tasks', remaining);

        const settings = state.get('settings');
        const profile = state.get('profile');
        const attributes = state.get('attributes') || [];
        const history = await taskEngine.getCompletionHistory();
        if (settings?.geminiApiKey) {
          const { AIService } = await import('../services/ai.js');
          const ai = new AIService(settings.geminiApiKey);
          const result = await ai.generateDailyTasks(profile, attributes, history);
          await taskEngine.createTasks(result.dailyTasks);
          if (result.systemMessage) showNotification(result.systemMessage, 'system');
        } else {
          const { AIService } = await import('../services/ai.js');
          const fallback = AIService.getFallbackSetup(profile);
          await taskEngine.createTasks(fallback.dailyTasks);
        }

        incrementRefresh();
        showNotification('Tasks refreshed.', 'success');
        renderDashboard(container);
      } catch (e) {
        console.error('Refresh error:', e);
        showNotification('Failed to refresh tasks: ' + e.message, 'error');
        refreshBtn.disabled = false;
        renderDashboard(container);
      }
    });
  }
}
