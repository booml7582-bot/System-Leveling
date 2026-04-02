// ============================================
// SOLO LEVELING SYSTEM — Reactive State Manager
// ============================================

class StateManager {
  constructor() {
    this._state = {
      profile: null,
      attributes: [],
      tasks: [],
      rankHistory: [],
      dailyLogs: [],
      settings: null,
      ui: {
        loading: false,
        currentPage: null,
        notification: null,
        modal: null,
      }
    };
    this._subscribers = new Map();
    this._globalSubscribers = [];
  }

  get(key) {
    if (key) {
      return key.split('.').reduce((obj, k) => obj?.[k], this._state);
    }
    return { ...this._state };
  }

  set(key, value) {
    const keys = key.split('.');
    let obj = this._state;
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
    }
    const oldValue = obj[keys[keys.length - 1]];
    obj[keys[keys.length - 1]] = value;

    // Notify key subscribers
    this._notify(key, value, oldValue);
    // Notify root key subscribers
    const rootKey = keys[0];
    if (keys.length > 1) {
      this._notify(rootKey, this._state[rootKey], null);
    }
    // Notify global subscribers
    this._globalSubscribers.forEach(fn => fn(this._state, key, value));
  }

  subscribe(key, fn) {
    if (!this._subscribers.has(key)) {
      this._subscribers.set(key, []);
    }
    this._subscribers.get(key).push(fn);

    // Return unsubscribe function
    return () => {
      const subs = this._subscribers.get(key);
      const idx = subs.indexOf(fn);
      if (idx > -1) subs.splice(idx, 1);
    };
  }

  subscribeAll(fn) {
    this._globalSubscribers.push(fn);
    return () => {
      const idx = this._globalSubscribers.indexOf(fn);
      if (idx > -1) this._globalSubscribers.splice(idx, 1);
    };
  }

  _notify(key, value, oldValue) {
    const subs = this._subscribers.get(key);
    if (subs) {
      subs.forEach(fn => fn(value, oldValue));
    }
  }

  // Batch update
  update(updates) {
    Object.entries(updates).forEach(([key, value]) => {
      this.set(key, value);
    });
  }
}

// Singleton
export const state = new StateManager();
