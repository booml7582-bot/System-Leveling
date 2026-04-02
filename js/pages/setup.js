// ============================================
// SOLO LEVELING SYSTEM — Setup Page
// ============================================

import { state } from '../state.js';
import { storage, generateId } from '../services/storage.js';
import { AIService } from '../services/ai.js';
import { attributeEngine } from '../engines/attribute-engine.js';
import { taskEngine } from '../engines/task-engine.js';
import { showNotification } from '../components/notification.js';

const STEPS = [
  { id: 'name', number: 'Step 01', title: 'What is your name?', desc: 'The System needs to identify its Player.', field: 'playerName', placeholder: 'Enter your name' },
  { id: 'goal', number: 'Step 02', title: 'Who do you want to become?', desc: 'Define the person you want to grow into. Be specific.', field: 'goalIdentity', placeholder: 'e.g. A disciplined software engineer with great physique and social skills' },
  { id: 'why', number: 'Step 03', title: 'Why do you want this?', desc: 'Your reason will fuel your consistency when things get hard.', field: 'goalReason', placeholder: 'e.g. I want to build a meaningful career and feel confident in myself' },
  { id: 'actions', number: 'Step 04', title: 'What do you think you need to do?', desc: 'List the actions you believe will get you there.', field: 'goalActions', placeholder: 'e.g. Code daily, exercise, read books, network with people, eat healthy' },
  { id: 'areas', number: 'Step 05', title: 'What areas should be tracked?', desc: 'Select or add attribute categories the System should monitor.', field: 'suggestedAreas', type: 'tags' },
  { id: 'hours', number: 'Step 06', title: 'How many hours can you dedicate per day?', desc: 'The System will generate tasks that fit within your daily time budget.', field: 'hoursPerDay', type: 'hours' },
  { id: 'interval', number: 'Step 07', title: 'Re-evaluation interval', desc: 'How often should the System re-evaluate your progress?', field: 'reEvalIntervalDays', type: 'select' },
  { id: 'api', number: 'Step 08', title: 'Connect to the System', desc: 'Enter your Gemini API key to enable AI-powered task generation. Get one free at ai.google.dev', field: 'geminiApiKey', type: 'api' },
];

const SUGGESTED_AREAS = ['Strength', 'Intelligence', 'Discipline', 'Social', 'Health', 'Knowledge', 'Creativity', 'Leadership', 'Focus', 'Endurance'];

let currentStep = 0;
let formData = { suggestedAreas: [], hoursPerDay: 3 };

export async function renderSetup(container) {
  currentStep = 0;
  formData = { suggestedAreas: [], hoursPerDay: 3 };
  render(container);
}

function render(container) {
  const step = STEPS[currentStep];
  container.innerHTML = `
    <div class="setup-page">
      <div class="setup-header">
        <h1>SYSTEM SETUP</h1>
        <p>Initializing Player Profile</p>
      </div>
      <div class="setup-progress" id="setup-progress">
        ${STEPS.map((_, i) => `<div class="setup-progress-dot ${i < currentStep ? 'completed' : ''} ${i === currentStep ? 'active' : ''}"></div>`).join('')}
      </div>
      <div class="setup-step" id="setup-step">
        <div class="setup-step-number">${step.number}</div>
        <h2 class="setup-step-title">${step.title}</h2>
        <p class="setup-step-desc">${step.desc}</p>
        ${renderField(step)}
      </div>
      <div class="setup-actions">
        ${currentStep > 0 ? '<button class="btn btn-secondary" id="setup-back">Back</button>' : '<div></div>'}
        ${currentStep < STEPS.length - 1
          ? '<button class="btn btn-primary" id="setup-next">Next</button>'
          : '<button class="btn btn-primary btn-lg" id="setup-finish">Awaken the System</button>'}
      </div>
    </div>
  `;
  bindEvents(container);
}

function renderField(step) {
  const val = formData[step.field] || '';
  if (step.type === 'tags') {
    const selected = formData.suggestedAreas || [];
    return `
      <div class="tag-input-container" id="tag-container">
        ${selected.map(t => `<span class="tag active">${t} <span class="tag-remove" data-tag="${t}">x</span></span>`).join('')}
        <input type="text" class="tag-input-field" id="tag-input" placeholder="Type and press Enter to add..." />
      </div>
      <div class="tag-suggestions">
        ${SUGGESTED_AREAS.filter(a => !selected.includes(a)).map(a => `<span class="tag" data-suggest="${a}">${a}</span>`).join('')}
      </div>
    `;
  }
  if (step.type === 'hours') {
    const hours = formData.hoursPerDay || 3;
    return `
      <div style="text-align:center;margin:var(--space-6) 0;">
        <div style="font-family:var(--font-heading);font-size:var(--text-5xl);font-weight:700;color:var(--color-accent-primary);margin-bottom:var(--space-2);" id="hours-display">${hours}</div>
        <div style="font-size:var(--text-sm);color:var(--color-text-muted);margin-bottom:var(--space-6);">hours per day</div>
        <input type="range" id="field-input" min="1" max="12" step="0.5" value="${hours}"
          style="width:100%;accent-color:var(--color-accent-primary);height:6px;cursor:pointer;" />
        <div style="display:flex;justify-content:space-between;font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-2);">
          <span>1h</span><span>3h</span><span>6h</span><span>12h</span>
        </div>
      </div>
    `;
  }
  if (step.type === 'select') {
    return `
      <select class="input select" id="field-input">
        <option value="7" ${val == 7 ? 'selected' : ''}>Every 7 days (Weekly)</option>
        <option value="14" ${val == 14 ? 'selected' : ''}>Every 14 days (Bi-weekly)</option>
        <option value="30" ${val == 30 ? 'selected' : ''}>Every 30 days (Monthly)</option>
      </select>
    `;
  }
  if (step.type === 'api') {
    return `
      <div class="input-group">
        <input type="password" class="input" id="field-input" placeholder="AIza..." value="${formData.geminiApiKey || ''}" />
        <div class="input-hint">Your key is stored locally and never sent anywhere except Google's API.</div>
        <button class="btn btn-secondary btn-sm" id="test-api" style="margin-top: 8px; align-self: flex-start;">Test Connection</button>
        <div id="api-status"></div>
      </div>
      <div style="margin-top: var(--space-4);">
        <button class="btn btn-ghost btn-sm" id="skip-api">Skip — use offline mode</button>
      </div>
    `;
  }
  if (step.id === 'name') {
    return `<input type="text" class="input" id="field-input" placeholder="${step.placeholder}" value="${val}" autofocus />`;
  }
  if (step.id === 'goal' || step.id === 'why' || step.id === 'actions') {
    return `<textarea class="input textarea" id="field-input" placeholder="${step.placeholder}" rows="4">${val}</textarea>`;
  }
  return `<input type="text" class="input" id="field-input" placeholder="${step.placeholder}" value="${val}" />`;
}

function bindEvents(container) {
  const step = STEPS[currentStep];
  const nextBtn = container.querySelector('#setup-next');
  const backBtn = container.querySelector('#setup-back');
  const finishBtn = container.querySelector('#setup-finish');
  const testBtn = container.querySelector('#test-api');
  const skipBtn = container.querySelector('#skip-api');

  if (nextBtn) nextBtn.addEventListener('click', () => { saveField(step); currentStep++; render(container); });
  if (backBtn) backBtn.addEventListener('click', () => { saveField(step); currentStep--; render(container); });
  if (finishBtn) finishBtn.addEventListener('click', () => finishSetup(container));
  if (testBtn) testBtn.addEventListener('click', () => testAPI(container));
  if (skipBtn) skipBtn.addEventListener('click', () => { formData.geminiApiKey = ''; finishSetup(container); });

  // Hours slider
  if (step.type === 'hours') {
    const input = container.querySelector('#field-input');
    const display = container.querySelector('#hours-display');
    if (input && display) {
      input.addEventListener('input', () => {
        display.textContent = input.value;
        formData.hoursPerDay = parseFloat(input.value);
      });
    }
  }

  // Tag events
  if (step.type === 'tags') {
    const input = container.querySelector('#tag-input');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
          e.preventDefault();
          const tag = input.value.trim();
          if (!formData.suggestedAreas.includes(tag)) {
            formData.suggestedAreas.push(tag);
            render(container);
          }
        }
      });
    }
    container.querySelectorAll('[data-suggest]').forEach(el => {
      el.addEventListener('click', () => {
        const tag = el.dataset.suggest;
        if (!formData.suggestedAreas.includes(tag)) {
          formData.suggestedAreas.push(tag);
          render(container);
        }
      });
    });
    container.querySelectorAll('.tag-remove').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        formData.suggestedAreas = formData.suggestedAreas.filter(t => t !== el.dataset.tag);
        render(container);
      });
    });
  }
}

function saveField(step) {
  if (step.type === 'tags') return;
  const input = document.getElementById('field-input');
  if (input) {
    if (step.type === 'select') formData[step.field] = parseInt(input.value);
    else if (step.type === 'hours') formData[step.field] = parseFloat(input.value);
    else formData[step.field] = input.value;
  }
}

async function testAPI(container) {
  const input = container.querySelector('#field-input');
  const statusEl = container.querySelector('#api-status');
  const key = input?.value?.trim();
  if (!key) { statusEl.innerHTML = '<span class="text-danger" style="font-size:0.85rem;">Please enter an API key</span>'; return; }
  statusEl.innerHTML = '<span class="text-accent" style="font-size:0.85rem;"><span class="spinner" style="display:inline-block;width:14px;height:14px;vertical-align:middle;margin-right:6px;"></span>Testing...</span>';
  const ai = new AIService(key);
  const result = await ai.testConnection();
  if (result.success) {
    statusEl.innerHTML = '<span class="text-success" style="font-size:0.85rem;">Connection successful</span>';
    formData.geminiApiKey = key;
  } else {
    statusEl.innerHTML = `<span class="text-danger" style="font-size:0.85rem;">${result.error}</span>`;
  }
}

async function finishSetup(container) {
  saveField(STEPS[currentStep]);
  container.innerHTML = `
    <div class="setup-page" style="justify-content:center;align-items:center;text-align:center;">
      <div class="loading-logo" style="font-size:2.5rem;">SYSTEM</div>
      <div class="spinner spinner-lg" style="margin:var(--space-6) auto;"></div>
      <p class="reeval-status" id="init-status">Analyzing Player potential...</p>
    </div>
  `;

  const statusEl = container.querySelector('#init-status');
  try {
    statusEl.textContent = 'Creating Player profile...';
    const profile = {
      id: 'player',
      playerName: formData.playerName || 'Player',
      goalIdentity: formData.goalIdentity || '',
      goalReason: formData.goalReason || '',
      goalActions: formData.goalActions || '',
      suggestedAreas: formData.suggestedAreas || [],
      hoursPerDay: formData.hoursPerDay || 3,
      profileContext: '',
      reEvalIntervalDays: formData.reEvalIntervalDays || 7,
      currentRank: 'E',
      totalXP: 0,
      level: 1,
      createdAt: new Date().toISOString(),
      lastReEvalAt: new Date().toISOString(),
      nextReEvalAt: new Date(Date.now() + (formData.reEvalIntervalDays || 7) * 86400000).toISOString(),
    };
    await storage.put('profile', profile);

    const settings = {
      id: 'main',
      geminiApiKey: formData.geminiApiKey || '',
      canvasApiToken: '',
      canvasDomain: '',
      theme: 'dark',
      difficulty: 'medium',
    };
    await storage.put('settings', settings);
    state.set('settings', settings);

    statusEl.textContent = 'Generating attributes and tasks...';
    let setupData;
    if (formData.geminiApiKey) {
      try {
        const ai = new AIService(formData.geminiApiKey);
        setupData = await ai.generateInitialSetup(profile);
      } catch (e) {
        console.warn('AI generation failed, using fallback:', e);
        setupData = AIService.getFallbackSetup(profile);
      }
    } else {
      setupData = AIService.getFallbackSetup(profile);
    }

    statusEl.textContent = 'Initializing attributes...';
    await attributeEngine.createAttributes(setupData.attributes);

    statusEl.textContent = 'Generating daily quests...';
    await taskEngine.createTasks(setupData.dailyTasks);

    statusEl.textContent = 'System awakening complete.';
    state.set('profile', profile);
    await new Promise(r => setTimeout(r, 1000));

    showNotification(setupData.systemMessage || `System initialized. Begin your journey, ${profile.playerName}.`, 'system');
    window.location.hash = '/dashboard';
  } catch (e) {
    console.error('Setup error:', e);
    statusEl.textContent = `Error: ${e.message}. Please try again.`;
    statusEl.style.color = 'var(--color-accent-danger)';
    setTimeout(() => { currentStep = STEPS.length - 1; render(container); }, 3000);
  }
}
