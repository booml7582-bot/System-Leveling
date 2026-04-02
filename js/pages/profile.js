// ============================================
// SOLO LEVELING SYSTEM — Profile Page
// ============================================
// "Tell us more" — lets the player add context for better task generation

import { state } from '../state.js';
import { storage } from '../services/storage.js';
import { showNotification } from '../components/notification.js';

export async function renderProfile(container) {
  const profile = state.get('profile');
  if (!profile) { window.location.hash = '/setup'; return; }

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div class="page-subtitle">Player Configuration</div>
        <h1 class="page-title">Profile</h1>
      </div>

      <div class="card" style="padding:var(--space-5);margin-bottom:var(--space-6);border-color:var(--color-border-primary);">
        <div style="font-family:var(--font-heading);font-size:var(--text-sm);letter-spacing:var(--tracking-wider);color:var(--color-accent-primary);margin-bottom:var(--space-3);text-transform:uppercase;">Why this matters</div>
        <p style="font-size:var(--text-sm);color:var(--color-text-secondary);line-height:1.7;">
          The more the System knows about you, the better it can generate tasks that fit your life.
          Tell the System about your schedule, specific skills you're building, tools you use, or any
          preferences for how tasks should be structured.
        </p>
      </div>

      <div class="input-group">
        <label class="input-label">Your Name</label>
        <input type="text" class="input" id="profile-name" value="${profile.playerName || ''}" placeholder="Enter your name" />
      </div>

      <div class="input-group">
        <label class="input-label">Hours Available Per Day</label>
        <div style="display:flex;align-items:center;gap:var(--space-4);">
          <input type="range" id="profile-hours" min="1" max="12" step="0.5" value="${profile.hoursPerDay || 3}"
            style="flex:1;accent-color:var(--color-accent-primary);height:6px;cursor:pointer;" />
          <span style="font-family:var(--font-heading);font-size:var(--text-xl);color:var(--color-accent-primary);min-width:48px;text-align:center;" id="hours-val">${profile.hoursPerDay || 3}h</span>
        </div>
        <div class="input-hint">Total daily task time will be adjusted to fit this budget.</div>
      </div>

      <hr class="divider" />

      <div class="input-group">
        <label class="input-label">Tell the System more about yourself</label>
        <textarea class="input textarea" id="profile-context" rows="5" placeholder="e.g. I'm a college student studying CS. I have classes from 8am-2pm. I prefer studying in the evening. I'm currently learning React and preparing for coding interviews. I go to the gym 3x a week.">${profile.profileContext || ''}</textarea>
        <div class="input-hint">This context helps the AI generate more relevant and specific tasks for you.</div>
      </div>

      <div class="input-group">
        <label class="input-label">How do you want your tasks structured?</label>
        <textarea class="input textarea" id="profile-taskPrefs" rows="4" placeholder="e.g. I prefer short focused sessions (25 min pomodoros). Break big tasks into smaller steps. I want at least one physical task per day. Mix creative and analytical work.">${profile.taskPreferences || ''}</textarea>
        <div class="input-hint">Guide how the System structures and formats your daily quests.</div>
      </div>

      <div class="input-group">
        <label class="input-label">Specific skills or projects you're working on</label>
        <textarea class="input textarea" id="profile-skills" rows="3" placeholder="e.g. Learning TypeScript, Building a portfolio site, Training for a 5K run, Reading 'Atomic Habits'">${profile.currentProjects || ''}</textarea>
        <div class="input-hint">The System will reference these when generating tasks.</div>
      </div>

      <div class="input-group">
        <label class="input-label">Things to avoid or limitations</label>
        <textarea class="input textarea" id="profile-avoid" rows="3" placeholder="e.g. I have a knee injury so no running. I don't have gym access on weekends. I can't study after 11pm.">${profile.limitations || ''}</textarea>
        <div class="input-hint">The System will respect these constraints when generating tasks.</div>
      </div>

      <div style="margin-top:var(--space-6);">
        <button class="btn btn-primary btn-block" id="save-profile">Save Profile</button>
      </div>

      <div style="margin-top:var(--space-3);text-align:center;">
        <p style="font-size:var(--text-xs);color:var(--color-text-muted);">Changes will take effect the next time tasks are generated.</p>
      </div>
    </div>
  `;

  // Hours slider
  const hoursSlider = container.querySelector('#profile-hours');
  const hoursVal = container.querySelector('#hours-val');
  if (hoursSlider && hoursVal) {
    hoursSlider.addEventListener('input', () => {
      hoursVal.textContent = hoursSlider.value + 'h';
    });
  }

  // Save
  container.querySelector('#save-profile')?.addEventListener('click', async () => {
    const p = await storage.get('profile', 'player');
    if (!p) return;

    p.playerName = container.querySelector('#profile-name').value.trim() || 'Player';
    p.hoursPerDay = parseFloat(container.querySelector('#profile-hours').value) || 3;

    // Build combined context for AI
    const context = container.querySelector('#profile-context').value.trim();
    const taskPrefs = container.querySelector('#profile-taskPrefs').value.trim();
    const skills = container.querySelector('#profile-skills').value.trim();
    const avoid = container.querySelector('#profile-avoid').value.trim();

    p.profileContext = [
      context ? `About me: ${context}` : '',
      taskPrefs ? `Task preferences: ${taskPrefs}` : '',
      skills ? `Current projects/skills: ${skills}` : '',
      avoid ? `Limitations: ${avoid}` : '',
    ].filter(Boolean).join('\n');

    p.taskPreferences = taskPrefs;
    p.currentProjects = skills;
    p.limitations = avoid;

    await storage.put('profile', p);
    state.set('profile', p);
    showNotification('Profile updated. Changes will apply to new task generation.', 'success');
  });
}
