// ============================================
// SOLO LEVELING SYSTEM — Canvas LMS Adapter
// ============================================

// Canvas blocks direct browser requests (CORS). We use three strategies in order:
// 1. Serverless Proxy — our own /api/canvas endpoint (works on Vercel deployment)
// 2. CORS Proxy — routes through public CORS proxies (fallback for local dev)
// 3. Direct — works only if your Canvas instance allows CORS from your origin

const CORS_PROXIES = [
  'https://corsproxy.io/?url=',
  'https://api.allorigins.win/raw?url=',
];

export class CanvasService {
  constructor(token, domain, useProxy = true) {
    this.token = token;
    this.domain = this._normalizeDomain(domain);
    this.useProxy = useProxy;
    this.workingProxy = null;
    this._serverlessAvailable = null; // null = unknown, true/false = tested
  }

  setConfig(token, domain, useProxy = true) {
    this.token = token;
    this.domain = this._normalizeDomain(domain);
    this.useProxy = useProxy;
    this.workingProxy = null;
    this._serverlessAvailable = null;
  }

  _normalizeDomain(domain) {
    if (!domain) return '';
    domain = domain.replace(/\/+$/, '').trim();
    if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
      domain = 'https://' + domain;
    }
    return domain;
  }

  async _fetch(endpoint) {
    if (!this.token || !this.domain) {
      throw new Error('Canvas not configured. Enter your Canvas domain and API token.');
    }

    // Strategy 1: Try our own serverless proxy first (best option on Vercel)
    if (this._serverlessAvailable !== false) {
      try {
        const data = await this._fetchServerless(endpoint);
        this._serverlessAvailable = true;
        return data;
      } catch (e) {
        // If it's an auth error from Canvas, throw immediately
        if (e.message.includes('Invalid API token')) throw e;
        // Otherwise the serverless function isn't available (local dev)
        this._serverlessAvailable = false;
      }
    }

    // Strategy 2: Public CORS proxies
    if (this.useProxy) {
      const apiUrl = this._buildApiUrl(endpoint);
      return this._fetchWithProxy(apiUrl);
    }

    // Strategy 3: Direct (only works if Canvas allows your origin)
    const apiUrl = this._buildApiUrl(endpoint);
    return this._fetchDirect(apiUrl);
  }

  // Serverless proxy — POST to our own /api/canvas endpoint
  async _fetchServerless(endpoint) {
    const res = await fetch('/api/canvas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: this.domain,
        token: this.token,
        endpoint,
      }),
    });

    if (res.status === 401) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Invalid API token. Check that your token is correct and has not expired.');
    }
    if (res.status === 404 || res.status === 405) {
      // Serverless function not deployed (local dev) — fall through
      throw new Error('Serverless proxy not available');
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Canvas proxy error (HTTP ${res.status})`);
    }

    return res.json();
  }

  // Build the Canvas API URL with access_token as query param
  _buildApiUrl(endpoint) {
    const separator = endpoint.includes('?') ? '&' : '?';
    return `${this.domain}/api/v1${endpoint}${separator}access_token=${encodeURIComponent(this.token)}`;
  }

  async _fetchDirect(url) {
    try {
      const res = await fetch(url);
      if (res.status === 401 || res.status === 403) {
        throw new Error('Invalid API token. Check that your token is correct and has not expired.');
      }
      if (!res.ok) {
        throw new Error(`Canvas API error (HTTP ${res.status}). Check your domain and token.`);
      }
      const data = await res.json();
      return data;
    } catch (e) {
      if (e.message.includes('Invalid API') || e.message.includes('Canvas API error')) {
        throw e;
      }
      throw new Error(
        'Could not reach Canvas — this is likely a CORS restriction. ' +
        'Your browser blocks direct requests to Canvas from this origin. ' +
        'Enable "Use CORS Proxy" in settings to bypass this.'
      );
    }
  }

  async _fetchWithProxy(url) {
    // If we already found a working proxy, try it first
    if (this.workingProxy) {
      try {
        return await this._tryProxy(this.workingProxy, url);
      } catch (e) {
        if (e.message.includes('Invalid API token')) throw e;
        this.workingProxy = null;
      }
    }

    const errors = [];
    for (const proxy of CORS_PROXIES) {
      try {
        const data = await this._tryProxy(proxy, url);
        this.workingProxy = proxy;
        return data;
      } catch (e) {
        errors.push({ proxy, error: e.message });
        if (e.message.includes('Invalid API token')) throw e;
      }
    }

    throw new Error(
      'Could not connect to Canvas through any proxy.\n\n' +
      'Possible causes:\n' +
      '• Your Canvas domain may be incorrect — it should look like "myschool.instructure.com"\n' +
      '• Your API token may be invalid or expired\n' +
      '• The CORS proxy services may be temporarily unavailable\n\n' +
      'Try disabling "Use CORS Proxy" if your Canvas allows direct access.\n\n' +
      'Proxy errors:\n' + errors.map(e => `• ${e.error}`).join('\n')
    );
  }

  async _tryProxy(proxyBase, url) {
    const proxiedUrl = proxyBase + encodeURIComponent(url);
    const res = await fetch(proxiedUrl);

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        'Invalid API token. Go to Canvas > Account > Settings > ' +
        '"+ New Access Token" to generate a new one.'
      );
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        throw new Error(`Proxy returned an error page (HTTP ${res.status}). The proxy might be blocking this request.`);
      }
      throw new Error(`Canvas error (HTTP ${res.status}): ${text.slice(0, 120)}`);
    }

    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      if (text.includes('"status"') || text.includes('"contents"')) {
        try {
          const wrapper = JSON.parse(text);
          if (wrapper.contents) return JSON.parse(wrapper.contents);
        } catch { /* fall through */ }
      }
      throw new Error(`Unexpected non-JSON response from Canvas. Check that your domain is correct.`);
    }
  }

  async getCourses() {
    return this._fetch('/courses?enrollment_state=active&per_page=50');
  }

  async getAssignments(courseId) {
    return this._fetch(`/courses/${courseId}/assignments?per_page=100&order_by=due_at`);
  }

  async getUpcomingAssignments() {
    try {
      const courses = await this.getCourses();
      if (!Array.isArray(courses)) {
        throw new Error(
          'Unexpected response from Canvas. Make sure your domain is correct ' +
          '(e.g. "myschool.instructure.com" not "myschool.instructure.com/courses").'
        );
      }
      const allAssignments = [];
      for (const course of courses) {
        try {
          const assignments = await this.getAssignments(course.id);
          if (!Array.isArray(assignments)) continue;
          const upcoming = assignments.filter(a => {
            if (!a.due_at) return false;
            const due = new Date(a.due_at);
            const now = new Date();
            const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
            return due > now && due < twoWeeks;
          });
          upcoming.forEach(a => {
            a._courseName = course.name;
            a._courseId = course.id;
          });
          allAssignments.push(...upcoming);
        } catch (e) {
          console.warn(`Skipped course ${course.name || course.id}:`, e.message);
        }
      }
      allAssignments.sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
      return allAssignments;
    } catch (e) {
      console.error('Canvas fetch error:', e);
      throw e;
    }
  }

  convertToTasks(assignments) {
    return assignments.map(a => ({
      title: a.name,
      description: `${a._courseName} — Due: ${new Date(a.due_at).toLocaleDateString()}`,
      durationMinutes: this._estimateDuration(a),
      difficulty: this._estimateDifficulty(a),
      isCanvasTask: true,
      canvasAssignmentId: String(a.id),
      dueDate: a.due_at,
      attributeRewards: this._guessRewards(a),
    }));
  }

  _estimateDuration(assignment) {
    const points = assignment.points_possible || 10;
    if (points <= 10) return 30;
    if (points <= 50) return 60;
    return 120;
  }

  _estimateDifficulty(assignment) {
    const points = assignment.points_possible || 10;
    if (points <= 10) return 'easy';
    if (points <= 50) return 'medium';
    return 'hard';
  }

  _guessRewards(assignment) {
    const name = (assignment.name || '').toLowerCase();
    const rewards = [{ attributeName: 'Discipline', xp: 3 }];
    if (name.includes('math') || name.includes('calc') || name.includes('algo') || name.includes('data')) {
      rewards.push({ attributeName: 'Intelligence', xp: 5 });
    } else if (name.includes('essay') || name.includes('write') || name.includes('read')) {
      rewards.push({ attributeName: 'Knowledge', xp: 5 });
    } else {
      rewards.push({ attributeName: 'Intelligence', xp: 4 });
    }
    return rewards;
  }

  async testConnection() {
    try {
      const courses = await this.getCourses();
      if (!Array.isArray(courses)) {
        return {
          success: false,
          error: 'Unexpected response from Canvas. Check your domain URL format (e.g. "myschool.instructure.com").',
        };
      }
      return {
        success: true,
        courseCount: courses.length,
        message: `Connected! Found ${courses.length} active course${courses.length !== 1 ? 's' : ''}.`,
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}
