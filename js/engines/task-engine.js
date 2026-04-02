// ============================================
// SOLO LEVELING SYSTEM — Task Engine
// ============================================

import { storage, generateId } from '../services/storage.js';
import { state } from '../state.js';

export class TaskEngine {
  // Create tasks from AI or manual input
  async createTasks(taskDefs, date = null) {
    const today = date || new Date().toISOString().split('T')[0];
    const tasks = taskDefs.map(def => ({
      id: generateId(),
      title: def.title,
      description: def.description || '',
      durationMinutes: def.durationMinutes || 30,
      status: 'pending',
      difficulty: def.difficulty || 'medium',
      createdAt: new Date().toISOString(),
      completedAt: null,
      dueDate: def.dueDate || today,
      isCanvasTask: def.isCanvasTask || false,
      canvasAssignmentId: def.canvasAssignmentId || null,
      attributeRewards: def.attributeRewards || [],
    }));
    await storage.putMany('tasks', tasks);
    const allTasks = await storage.getAll('tasks');
    state.set('tasks', allTasks);
    return tasks;
  }

  // Complete a task
  async completeTask(taskId) {
    const task = await storage.get('tasks', taskId);
    if (!task || task.status === 'completed') return null;
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    await storage.put('tasks', task);
    const allTasks = await storage.getAll('tasks');
    state.set('tasks', allTasks);
    return task;
  }

  // Uncomplete a task
  async uncompleteTask(taskId) {
    const task = await storage.get('tasks', taskId);
    if (!task) return null;
    task.status = 'pending';
    task.completedAt = null;
    await storage.put('tasks', task);
    const allTasks = await storage.getAll('tasks');
    state.set('tasks', allTasks);
    return task;
  }

  // Get today's tasks
  getTodaysTasks(allTasks) {
    const today = new Date().toISOString().split('T')[0];
    return (allTasks || []).filter(t => t.dueDate && t.dueDate.startsWith(today));
  }

  // Get completion stats
  getCompletionStats(tasks) {
    const todayTasks = this.getTodaysTasks(tasks);
    const completed = todayTasks.filter(t => t.status === 'completed').length;
    const total = todayTasks.length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, rate };
  }

  // Get streak
  async getStreak() {
    const logs = await storage.getAll('dailyLogs');
    logs.sort((a, b) => new Date(b.date) - new Date(a.date));
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < logs.length; i++) {
      const logDate = new Date(logs[i].date);
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      if (logDate.toISOString().split('T')[0] === expected.toISOString().split('T')[0]) {
        if (logs[i].tasksCompleted > 0) streak++;
        else break;
      } else break;
    }
    return streak;
  }

  // Log daily completion
  async logDay() {
    const tasks = state.get('tasks') || [];
    const todayTasks = this.getTodaysTasks(tasks);
    const completed = todayTasks.filter(t => t.status === 'completed').length;
    const total = todayTasks.length;
    const xp = todayTasks
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + (t.attributeRewards || []).reduce((s, r) => s + r.xp, 0), 0);
    const today = new Date().toISOString().split('T')[0];
    const log = {
      id: `log_${today}`,
      date: today,
      tasksCompleted: completed,
      tasksTotal: total,
      xpEarned: xp,
    };
    await storage.put('dailyLogs', log);
    return log;
  }

  // Get recent completion history
  async getCompletionHistory(days = 7) {
    const logs = await storage.getAll('dailyLogs');
    logs.sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent = logs.slice(0, days);
    const totalCompleted = recent.reduce((s, l) => s + l.tasksCompleted, 0);
    const totalTasks = recent.reduce((s, l) => s + l.tasksTotal, 0);
    const recentRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;
    const streak = await this.getStreak();
    return { recentRate, streak, logs: recent };
  }

  // Calculate total XP from a task
  getTaskXP(task) {
    return (task.attributeRewards || []).reduce((sum, r) => sum + r.xp, 0);
  }
}

export const taskEngine = new TaskEngine();
