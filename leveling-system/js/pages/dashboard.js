// ============================================
// SOLO LEVELING SYSTEM — Dashboard Page
// ============================================

import { state } from '../state.js';
import { storage } from '../services/storage.js';
import { taskEngine } from '../engines/task-engine.js';
import { attributeEngine } from '../engines/attribute-engine.js';
import { reEvalEngine } from '../engines/reeval-engine.js';
import { showNotification } from '../components/notification.js';

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
          ${task.isCanvasTask ? '<span class="badge badge-purple" style="font-size:0.6rem;">Canvas</span>' : ''}
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

function bindDashboardEvents(container) {
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
        // Delete today's tasks
        const tasks = state.get('tasks') || [];
        const today = new Date().toISOString().split('T')[0];
        const todayTaskIds = tasks.filter(t => t.dueDate && t.dueDate.startsWith(today)).map(t => t.id);
        for (const id of todayTaskIds) {
          await storage.delete('tasks', id);
        }
        const remaining = tasks.filter(t => !todayTaskIds.includes(t.id));
        state.set('tasks', remaining);

        // Generate new tasks
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
