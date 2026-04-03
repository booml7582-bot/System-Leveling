// ============================================
// SOLO LEVELING SYSTEM — Push Notification Service
// ============================================

import { storage } from './storage.js';

const REMINDER_INTERVALS = [
  { label: '1 week before', days: 7 },
  { label: '3 days before', days: 3 },
  { label: '1 day before', days: 1 },
];

// Key for tracking sent notifications in localStorage
const SENT_KEY = 'sls_sent_notifications';

class NotificationService {
  constructor() {
    this.permission = 'default';
    this.swRegistration = null;
    this._checkInterval = null;
  }

  // Initialize: register service worker + request permission
  async init() {
    // Register service worker for background notifications
    if ('serviceWorker' in navigator) {
      try {
        this.swRegistration = await navigator.serviceWorker.register('/sw.js');
        console.log('[Notifications] Service worker registered');
      } catch (e) {
        console.warn('[Notifications] Service worker registration failed:', e);
      }
    }

    // Check current permission
    if ('Notification' in window) {
      this.permission = Notification.permission;
    }

    // Start periodic check (every 30 minutes)
    this._startPeriodicCheck();
  }

  // Request permission from the user
  async requestPermission() {
    if (!('Notification' in window)) {
      return { granted: false, reason: 'Notifications not supported in this browser.' };
    }

    if (Notification.permission === 'granted') {
      this.permission = 'granted';
      return { granted: true };
    }

    if (Notification.permission === 'denied') {
      this.permission = 'denied';
      return { granted: false, reason: 'Notifications are blocked. Please enable them in your browser settings.' };
    }

    try {
      const result = await Notification.requestPermission();
      this.permission = result;
      return { granted: result === 'granted' };
    } catch (e) {
      return { granted: false, reason: e.message };
    }
  }

  // Check if permission is granted
  isEnabled() {
    return 'Notification' in window && Notification.permission === 'granted';
  }

  // Get sent notification keys
  _getSentKeys() {
    try {
      return JSON.parse(localStorage.getItem(SENT_KEY) || '[]');
    } catch { return []; }
  }

  // Mark a notification as sent
  _markSent(key) {
    const sent = this._getSentKeys();
    if (!sent.includes(key)) {
      sent.push(key);
      // Keep only last 500 to avoid bloat
      if (sent.length > 500) sent.splice(0, sent.length - 500);
      localStorage.setItem(SENT_KEY, JSON.stringify(sent));
    }
  }

  // Check if notification was already sent
  _wasSent(key) {
    return this._getSentKeys().includes(key);
  }

  // Send a browser notification
  async _sendNotification(title, body, tag) {
    if (!this.isEnabled()) return;

    const options = {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag, // prevents duplicate notifications with same tag
      requireInteraction: false,
      silent: false,
    };

    try {
      // Use service worker if available (works in background on mobile)
      if (this.swRegistration) {
        await this.swRegistration.showNotification(title, options);
      } else {
        new Notification(title, options);
      }
    } catch (e) {
      console.warn('[Notifications] Failed to send:', e);
      // Fallback to basic Notification
      try { new Notification(title, options); } catch { /* ignore */ }
    }
  }

  // Check all assignments and send due reminders
  async checkAndNotify() {
    if (!this.isEnabled()) return;

    try {
      const assignments = await storage.getAll('canvasAssignments');
      const now = new Date();

      for (const assignment of assignments) {
        if (assignment.status === 'completed' || !assignment.dueDate) continue;

        const due = new Date(assignment.dueDate);
        if (due <= now) continue; // already past

        const hoursUntilDue = (due - now) / (1000 * 60 * 60);
        const daysUntilDue = hoursUntilDue / 24;

        for (const reminder of REMINDER_INTERVALS) {
          // Check if we're within the notification window for this interval
          // Notify if within 12 hours AFTER the reminder point
          const reminderHoursLeft = reminder.days * 24;
          if (hoursUntilDue <= reminderHoursLeft && hoursUntilDue > (reminderHoursLeft - 12)) {
            const key = `${assignment.id}_${reminder.days}d`;
            if (!this._wasSent(key)) {
              const dateStr = due.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              const timeStr = due.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
              await this._sendNotification(
                `Assignment Reminder`,
                `"${assignment.title}" is due ${reminder.label} (${dateStr}, ${timeStr})`,
                key
              );
              this._markSent(key);
            }
          }
        }
      }

      // Also check daily tasks
      const tasks = await storage.getAll('tasks');
      const today = new Date().toISOString().split('T')[0];
      const todayTasks = tasks.filter(t => t.dueDate?.startsWith(today) && t.status === 'pending');
      if (todayTasks.length > 0) {
        const hour = now.getHours();
        // Morning reminder (8 AM)
        if (hour >= 8 && hour < 9) {
          const key = `tasks_morning_${today}`;
          if (!this._wasSent(key)) {
            await this._sendNotification(
              'Daily Quests Available',
              `You have ${todayTasks.length} quest${todayTasks.length !== 1 ? 's' : ''} to complete today.`,
              key
            );
            this._markSent(key);
          }
        }
        // Evening reminder (8 PM)
        if (hour >= 20 && hour < 21) {
          const key = `tasks_evening_${today}`;
          if (!this._wasSent(key)) {
            await this._sendNotification(
              'Quests Incomplete',
              `${todayTasks.length} quest${todayTasks.length !== 1 ? 's' : ''} still pending. Don't break your streak.`,
              key
            );
            this._markSent(key);
          }
        }
      }
    } catch (e) {
      console.warn('[Notifications] Check failed:', e);
    }
  }

  // Start checking every 30 minutes
  _startPeriodicCheck() {
    // Check immediately on init
    setTimeout(() => this.checkAndNotify(), 3000);
    // Then every 30 minutes
    this._checkInterval = setInterval(() => this.checkAndNotify(), 30 * 60 * 1000);
  }

  // Schedule notifications for a specific assignment (called when creating/importing)
  async scheduleForAssignment(assignment) {
    if (!this.isEnabled() || !assignment.dueDate) return;
    // The periodic check handles actual delivery — this is just for immediate check
    await this.checkAndNotify();
  }

  // Clean up
  destroy() {
    if (this._checkInterval) {
      clearInterval(this._checkInterval);
      this._checkInterval = null;
    }
  }
}

export const notificationService = new NotificationService();
