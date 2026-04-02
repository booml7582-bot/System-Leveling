// ============================================
// SOLO LEVELING SYSTEM — Canvas LMS Adapter
// ============================================

// Canvas blocks direct browser requests (CORS). We offer two modes:
// 1. CORS Proxy — routes requests through a public CORS proxy (default)
//    NOTE: We pass the access_token as a URL param instead of Authorization header
//    because most CORS proxies block custom headers in preflight.
// 2. Direct — works only if your Canvas instance allows CORS from your origin

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
  }

  setConfig(token, domain, useProxy = true) {
    this.token = token;
    this.domain = this._normalizeDomain(domain);
    this.useProxy = useProxy;
    this.workingProxy = null;
  }

  _normalizeDomain(domain) {
    if (!domain) return '';
    domain = domain.replace(/\/+$/, '').trim();
    if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
      domain = 'https://' + domain;
    }
    return domain;
  }

  // Build the Canvas API URL with access_token as query param
  // (avoids CORS preflight issues with Authorization header)
  _buildApiUrl(endpoint) {
    const separator = endpoint.includes('?') ? '&' : '?';
    return `${this.domain}/api/v1${endpoint}${separator}access_token=${encodeURIComponent(this.token)}`;
  }

  async _fetch(endpoint) {
    if (!this.token || !this.domain) {
      throw new Error('Canvas not configured. Enter your Canvas domain and API token.');
    }

    const apiUrl = this._buildApiUrl(endpoint);

    if (this.useProxy) {
      return this._fetchWithProxy(apiUrl);
    }
    return this._fetchDirect(apiUrl);
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
        // If it was an auth error, throw immediately (no point trying others)
        if (e.message.includes('Invalid API token')) throw e;
        // Otherwise the proxy may be down, fall through to try others
        this.workingProxy = null;
      }
    }

    const errors = [];
    for (const proxy of CORS_PROXIES) {
      try {
        const data = await this._tryProxy(proxy, url);
        this.workingProxy = proxy; // remember for future calls
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
    // Do NOT send Authorization header — the token is already in the URL
    // This avoids the CORS preflight that blocks custom headers
    const res = await fetch(proxiedUrl);

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        'Invalid API token. Go to Canvas → Account → Settings → ' +
        '"+ New Access Token" to generate a new one.'
      );
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // Check if the proxy returned an error page rather than JSON
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        throw new Error(`Proxy returned an error page (HTTP ${res.status}). The proxy might be blocking this request.`);
      }
      throw new Error(`Canvas error (HTTP ${res.status}): ${text.slice(0, 120)}`);
    }

    const text = await res.text();
    // Validate we got JSON back
    try {
      return JSON.parse(text);
    } catch {
      // If the response isn't JSON, it could be the proxy wrapping it
      if (text.includes('"status"') || text.includes('"contents"')) {
        // Some proxies wrap the response in a JSON object
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
    const rewards = [{ attributeName: 'Discipline', xp: 5 }];
    if (name.includes('math') || name.includes('calc') || name.includes('algo') || name.includes('data')) {
      rewards.push({ attributeName: 'Intelligence', xp: 10 });
    } else if (name.includes('essay') || name.includes('write') || name.includes('read')) {
      rewards.push({ attributeName: 'Knowledge', xp: 10 });
    } else {
      rewards.push({ attributeName: 'Intelligence', xp: 8 });
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
