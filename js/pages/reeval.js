// ============================================
// SOLO LEVELING SYSTEM — Re-Evaluation Page
// ============================================

import { state } from '../state.js';
import { storage } from '../services/storage.js';
import { reEvalEngine } from '../engines/reeval-engine.js';
import { taskEngine } from '../engines/task-engine.js';
import { attributeEngine } from '../engines/attribute-engine.js';
import { AIService } from '../services/ai.js';
import { showNotification } from '../components/notification.js';

export async function renderReEval(container) {
  const profile = state.get('profile');
  if (!profile) { window.location.hash = '/setup'; return; }

  const isDue = reEvalEngine.isReEvalDue(profile);
  const time = reEvalEngine.getTimeRemaining(profile);
  const history = await reEvalEngine.getHistory();

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div class="page-subtitle">System Analysis</div>
        <h1 class="page-title">Re-Evaluation</h1>
      </div>
      ${isDue ? renderReEvalReady() : renderCountdown(time)}
      ${history.length > 0 ? `
        <div class="section" style="margin-top:var(--space-8);">
          <div class="section-title">Past Evaluations</div>
          ${history.map(entry => `
            <div class="reeval-result-item">
              <div>
                <div style="font-family:var(--font-heading);font-size:var(--text-sm);margin-bottom:2px;">
                  ${entry.oldRank} &rarr; ${entry.newRank}
                </div>
                <div style="font-size:var(--text-xs);color:var(--color-text-muted);">${new Date(entry.triggeredAt).toLocaleDateString()}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:var(--text-xs);color:var(--color-text-muted);">Completion: ${entry.taskCompletionRate}%</div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
  if (isDue) {
    container.querySelector('#start-reeval')?.addEventListener('click', () => runReEval(container));
  }
}

function renderCountdown(time) {
  return `
    <div class="reeval-countdown">
      <div style="font-size:var(--text-3xl);opacity:0.3;margin-bottom:var(--space-4);">—</div>
      <div class="reeval-timer">
        ${time.days}<span style="font-size:var(--text-xl);color:var(--color-text-muted);">d</span>
        ${String(time.hours).padStart(2, '0')}<span style="font-size:var(--text-xl);color:var(--color-text-muted);">h</span>
        ${String(time.minutes).padStart(2, '0')}<span style="font-size:var(--text-xl);color:var(--color-text-muted);">m</span>
      </div>
      <div class="reeval-label">Until Next Re-Evaluation</div>
      <p style="color:var(--color-text-muted);font-size:var(--text-sm);margin-top:var(--space-4);max-width:400px;margin-left:auto;margin-right:auto;">
        The System will analyze your progress, task completion, and consistency to determine your new rank.
      </p>
    </div>
  `;
}

function renderReEvalReady() {
  return `
    <div class="card card-glow" style="text-align:center;padding:var(--space-8);">
      <h2 style="font-size:var(--text-2xl);margin-bottom:var(--space-2);">Re-Evaluation Ready</h2>
      <p style="color:var(--color-text-muted);font-size:var(--text-sm);margin-bottom:var(--space-6);max-width:360px;margin-left:auto;margin-right:auto;">
        The evaluation period has ended. The System will now analyze your performance and determine your rank.
      </p>
      <button class="btn btn-primary btn-lg" id="start-reeval">Begin Re-Evaluation</button>
    </div>
  `;
}

async function runReEval(container) {
  container.innerHTML = `
    <div class="page">
      <div class="reeval-active">
        <div class="reeval-status" id="reeval-status">System Re-Evaluating...</div>
        <div class="spinner spinner-lg" style="margin:var(--space-4) auto;"></div>
        <p style="color:var(--color-text-muted);font-size:var(--text-sm);" id="reeval-substatus">Analyzing task history...</p>
      </div>
    </div>
  `;

  const statusEl = container.querySelector('#reeval-status');
  const subStatus = container.querySelector('#reeval-substatus');

  try {
    const profile = state.get('profile');
    const attributes = state.get('attributes') || [];
    const tasks = state.get('tasks') || [];
    const rankHistory = await storage.getAll('rankHistory');
    const settings = state.get('settings');

    subStatus.textContent = 'Gathering performance data...';
    await new Promise(r => setTimeout(r, 800));

    let aiResult = null;
    if (settings?.geminiApiKey) {
      subStatus.textContent = 'Running AI analysis...';
      try {
        const ai = new AIService(settings.geminiApiKey);
        aiResult = await ai.performReEvaluation(profile, attributes, tasks, rankHistory);
      } catch (e) { console.warn('AI re-eval failed:', e); }
    }

    subStatus.textContent = 'Calculating rank...';
    await new Promise(r => setTimeout(r, 600));

    const result = await reEvalEngine.performReEval(profile, aiResult);

    statusEl.textContent = 'Re-Evaluation Complete';
    subStatus.textContent = '';
    await new Promise(r => setTimeout(r, 800));

    showResults(container, result);

    if (result.rankChanged) {
      showNotification(`Rank ${result.oldRank} to ${result.newRank}`, result.newRank > result.oldRank ? 'success' : 'warning');
    }

    if (result.adjustedTasks?.length > 0) {
      await taskEngine.createTasks(result.adjustedTasks);
    }
  } catch (e) {
    console.error('Re-eval error:', e);
    statusEl.textContent = 'Error during re-evaluation';
    subStatus.textContent = e.message;
    subStatus.style.color = 'var(--color-accent-danger)';
  }
}

function showResults(container, result) {
  const rankColors = { E: 'var(--rank-E)', D: 'var(--rank-D)', C: 'var(--rank-C)', B: 'var(--rank-B)', A: 'var(--rank-A)', S: 'var(--rank-S)' };
  container.innerHTML = `
    <div class="page">
      <div class="page-header"><div class="page-subtitle">Analysis Complete</div><h1 class="page-title">Results</h1></div>
      <div class="reeval-results">
        ${result.rankChanged ? `
          <div class="card card-glow" style="text-align:center;padding:var(--space-6);margin-bottom:var(--space-4);">
            <div style="font-size:var(--text-sm);color:var(--color-text-muted);margin-bottom:var(--space-2);">RANK CHANGE</div>
            <div style="display:flex;align-items:center;justify-content:center;gap:var(--space-4);">
              <span style="font-size:var(--text-3xl);font-family:var(--font-heading);font-weight:700;color:${rankColors[result.oldRank]};">${result.oldRank}</span>
              <span style="font-size:var(--text-2xl);color:var(--color-text-muted);">&rarr;</span>
              <span style="font-size:var(--text-4xl);font-family:var(--font-heading);font-weight:700;color:${rankColors[result.newRank]};animation:rankUpReveal 0.6s ease;">${result.newRank}</span>
            </div>
          </div>
        ` : `
          <div class="card" style="text-align:center;padding:var(--space-6);margin-bottom:var(--space-4);">
            <div style="font-size:var(--text-sm);color:var(--color-text-muted);margin-bottom:var(--space-2);">RANK MAINTAINED</div>
            <div style="font-size:var(--text-4xl);font-family:var(--font-heading);font-weight:700;color:${rankColors[result.newRank]};">${result.newRank}</div>
          </div>
        `}
        <div class="stats-row" style="margin-bottom:var(--space-4);">
          <div class="stat-card"><div class="stat-value">${result.completionRate}%</div><div class="stat-label">Completion</div></div>
          <div class="stat-card"><div class="stat-value">${result.consistencyScore}%</div><div class="stat-label">Consistency</div></div>
        </div>
        ${result.aiSummary ? `
          <div class="system-message" style="margin-bottom:var(--space-4);">
            <div class="system-message-label">SYSTEM ANALYSIS</div>
            <div class="system-message-text">${result.aiSummary}</div>
          </div>
        ` : ''}
        ${result.aiRecommendations ? `
          <div class="card" style="margin-bottom:var(--space-4);">
            <div class="card-title" style="margin-bottom:var(--space-2);">Recommendations</div>
            <div class="card-body" style="font-size:var(--text-sm);">${result.aiRecommendations}</div>
          </div>
        ` : ''}
        <button class="btn btn-primary btn-block" onclick="window.location.hash='/dashboard'">Return to Dashboard</button>
      </div>
    </div>
  `;
}
