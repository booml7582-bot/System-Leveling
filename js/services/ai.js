// ============================================
// SOLO LEVELING SYSTEM — AI Service (Gemini)
// ============================================

const DEFAULT_MODEL = 'gemini-2.5-flash';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class AIService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.model = DEFAULT_MODEL;
  }

  setApiKey(key) { this.apiKey = key; }

  async _request(prompt, systemInstruction = '') {
    if (!this.apiKey) throw new Error('No API key configured');
    const url = `${API_BASE}/${this.model}:generateContent?key=${this.apiKey}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.8 },
    };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error: ${res.status}`);
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty AI response');
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/```json\s*([\s\S]*?)```/);
      if (match) return JSON.parse(match[1]);
      return JSON.parse(text.replace(/^[^{[]*/, '').replace(/[^}\]]*$/, ''));
    }
  }

  async testConnection() {
    try {
      await this._request('Respond with: {"status":"ok"}', 'Return valid JSON only.');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async generateInitialSetup(profile) {
    const system = `You are the "System" from Solo Leveling. You analyze a user's goals and generate personalized growth attributes and daily tasks. Always respond in valid JSON format only. NEVER use emojis anywhere in your response — keep everything clean and text-only.`;
    const hoursNote = profile.hoursPerDay ? `The player has ${profile.hoursPerDay} hours per day to dedicate. Total task time must fit within this budget.` : '';
    const profileContext = profile.profileContext ? `Additional player context: "${profile.profileContext}"` : '';
    const prompt = `A new Player has awakened. Analyze their goals and generate their initial System configuration.

Player Name: "${profile.playerName || 'Player'}"
Player Goal: "${profile.goalIdentity}"
Reason: "${profile.goalReason}"
Planned Actions: "${profile.goalActions}"
User Suggested Areas: ${JSON.stringify(profile.suggestedAreas || [])}
${hoursNote}
${profileContext}

Generate a JSON response with this exact structure:
{
  "attributes": [
    {
      "name": "string (attribute name, no emojis)",
      "startingValue": 0,
      "maxValue": 10000,
      "category": "string (physical/mental/social/skill)"
    }
  ],
  "dailyTasks": [
    {
      "title": "string (specific, actionable task, no emojis)",
      "description": "string (brief context on why, no emojis)",
      "durationMinutes": number,
      "difficulty": "easy|medium|hard",
      "attributeRewards": [
        { "attributeName": "string", "xp": number (2-5) }
      ]
    }
  ],
  "systemMessage": "string (motivating welcome message in System voice, 1-2 sentences, no emojis)"
}

CRITICAL RULES:
- NEVER use emojis anywhere in the response
- Generate 3-6 attributes based on the user's goals
- Include any areas the user suggested, plus add relevant ones they missed
- Generate 4-7 daily tasks that are SPECIFIC and ACTIONABLE
- Tasks should be achievable in one day
- Each task must specify a duration in minutes
${profile.hoursPerDay ? `- Total task time must not exceed ${profile.hoursPerDay * 60} minutes` : ''}
- Bad example: "Study more" | Good example: "Study Data Structures for 30 minutes"
- XP rewards must be LOW: 2-5 XP per attribute per task (growth should be very slow and gradual)
- Attribute rewards should logically match the task
- startingValue for all attributes should be 0
- The system message should be motivating and in-character as the System`;

    return this._request(prompt, system);
  }

  async generateDailyTasks(profile, attributes, completionHistory) {
    const system = `You are the "System" from Solo Leveling. Generate daily tasks for the player. Respond in valid JSON only. NEVER use emojis.`;
    const hoursNote = profile.hoursPerDay ? `Time budget: ${profile.hoursPerDay} hours/day. Total task time must not exceed ${profile.hoursPerDay * 60} minutes.` : '';
    const profileContext = profile.profileContext ? `Player context: "${profile.profileContext}"` : '';
    const prompt = `Generate today's daily tasks for this Player.

Player Name: "${profile.playerName || 'Player'}"
Player Goal: "${profile.goalIdentity}"
Current Rank: ${profile.currentRank}
Day Number: ${profile.dayNumber || 1}
${hoursNote}
${profileContext}

Current Attributes:
${attributes.map(a => `- ${a.name}: Level ${Math.floor(a.currentValue / 100) + 1} | ${a.currentValue} XP`).join('\n')}

Recent Completion Rate: ${completionHistory?.recentRate || 'N/A'}%
Streak: ${completionHistory?.streak || 0} days

Respond with:
{
  "dailyTasks": [
    {
      "title": "string (no emojis)",
      "description": "string (no emojis)",
      "durationMinutes": number,
      "difficulty": "easy|medium|hard",
      "attributeRewards": [{ "attributeName": "string", "xp": number (2-5) }]
    }
  ],
  "systemMessage": "string (brief daily system message, no emojis)"
}

Rules:
- NEVER use emojis
- Generate 4-7 tasks
- Tasks must be SPECIFIC and TIME-BOUND
- Adjust difficulty based on completion rate (lower if < 50%, raise if > 80%)
- XP rewards must be LOW: 2-5 XP per attribute per task
${profile.hoursPerDay ? `- Total task time must not exceed ${profile.hoursPerDay * 60} minutes` : ''}
- Each task should take 5-60 minutes`;

    return this._request(prompt, system);
  }

  async performReEvaluation(profile, attributes, taskHistory, rankHistory) {
    const system = `You are the "System" from Solo Leveling performing a periodic re-evaluation. Respond in valid JSON only. NEVER use emojis.`;
    const completedTasks = taskHistory.filter(t => t.status === 'completed').length;
    const totalTasks = taskHistory.length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const prompt = `Perform a re-evaluation of this Player.

Player Name: "${profile.playerName || 'Player'}"
Player Goal: "${profile.goalIdentity}"
Current Rank: ${profile.currentRank}
Days Since Last Evaluation: ${profile.reEvalIntervalDays}

Attributes:
${attributes.map(a => `- ${a.name}: ${a.currentValue} XP (Level ${Math.floor(a.currentValue / 100) + 1})`).join('\n')}

Task Performance:
- Total Tasks: ${totalTasks}
- Completed: ${completedTasks}
- Completion Rate: ${completionRate}%

Rank History: ${JSON.stringify(rankHistory.slice(-3))}

Respond with:
{
  "recommendedRank": "E|D|C|B|A|S",
  "taskCompletionRate": ${completionRate},
  "consistencyScore": number (0-100),
  "attributeGrowthScore": number (0-100),
  "summary": "string (2-3 sentence evaluation, no emojis)",
  "recommendations": "string (what the player should focus on, no emojis)",
  "adjustedTasks": [
    {
      "title": "string (no emojis)",
      "description": "string (no emojis)",
      "durationMinutes": number,
      "difficulty": "easy|medium|hard",
      "attributeRewards": [{ "attributeName": "string", "xp": number (2-5) }]
    }
  ],
  "attributeAdjustments": [
    { "attributeName": "string", "action": "keep|boost|reduce", "reason": "string" }
  ],
  "systemMessage": "string (re-evaluation announcement in System voice, no emojis)"
}

CRITICAL: XP rewards in adjustedTasks must be 2-5 per attribute. Do NOT use emojis anywhere.`;

    return this._request(prompt, system);
  }

  // Fallback templates when API is unavailable
  static getFallbackSetup(profile) {
    const suggestedAreas = profile.suggestedAreas || ['Discipline', 'Intelligence', 'Strength'];
    const hours = profile.hoursPerDay || 3;
    const attrs = [
      { name: 'Discipline', startingValue: 0, maxValue: 10000, category: 'mental' },
      { name: 'Intelligence', startingValue: 0, maxValue: 10000, category: 'mental' },
      { name: 'Strength', startingValue: 0, maxValue: 10000, category: 'physical' },
      { name: 'Social', startingValue: 0, maxValue: 10000, category: 'social' },
      { name: 'Health', startingValue: 0, maxValue: 10000, category: 'physical' },
    ];
    const filtered = attrs.filter(a =>
      suggestedAreas.some(s => a.name.toLowerCase().includes(s.toLowerCase())) || attrs.indexOf(a) < 3
    );
    const usedAttrs = filtered.length >= 3 ? filtered : attrs.slice(0, 4);

    // Scale tasks to hours budget
    const baseTasks = [
      { title: 'Morning Planning Session', description: 'Plan your day for 10 minutes', durationMinutes: 10, difficulty: 'easy', attributeRewards: [{ attributeName: 'Discipline', xp: 2 }] },
      { title: 'Focused Study Block', description: 'Study or practice your main skill for 30 minutes', durationMinutes: 30, difficulty: 'medium', attributeRewards: [{ attributeName: 'Intelligence', xp: 4 }] },
      { title: 'Physical Training', description: 'Do 15 minutes of exercise', durationMinutes: 15, difficulty: 'easy', attributeRewards: [{ attributeName: 'Strength', xp: 3 }, { attributeName: 'Health', xp: 2 }] },
      { title: 'Evening Review', description: 'Reflect on what you accomplished today', durationMinutes: 5, difficulty: 'easy', attributeRewards: [{ attributeName: 'Discipline', xp: 2 }] },
    ];

    const totalMins = baseTasks.reduce((s, t) => s + t.durationMinutes, 0);
    const budget = hours * 60;
    const tasks = totalMins <= budget ? baseTasks : baseTasks.slice(0, 3);

    const name = profile.playerName || 'Player';
    return {
      attributes: usedAttrs,
      dailyTasks: tasks,
      systemMessage: `System initialized. Your journey begins now, ${name}. Complete your daily tasks to grow stronger.`,
    };
  }
}
