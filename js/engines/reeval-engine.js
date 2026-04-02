// ============================================
// SOLO LEVELING SYSTEM — Re-Evaluation Engine
// ============================================

import { storage, generateId } from '../services/storage.js';
import { state } from '../state.js';
import { rankEngine } from './rank-engine.js';
import { taskEngine } from './task-engine.js';
import { attributeEngine } from './attribute-engine.js';

export class ReEvalEngine {
  // Check if re-evaluation is due
  isReEvalDue(profile) {
    if (!profile || !profile.nextReEvalAt) return false;
    return new Date() >= new Date(profile.nextReEvalAt);
  }

  // Get days until re-eval
  getDaysUntilReEval(profile) {
    if (!profile || !profile.nextReEvalAt) return 0;
    const diff = new Date(profile.nextReEvalAt) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  // Get time remaining details
  getTimeRemaining(profile) {
    if (!profile || !profile.nextReEvalAt) return { days: 0, hours: 0, minutes: 0 };
    const diff = Math.max(0, new Date(profile.nextReEvalAt) - new Date());
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return { days, hours, minutes, totalMs: diff };
  }

  // Perform re-evaluation with AI results
  async performReEval(profile, aiResult) {
    const attributes = await storage.getAll('attributes');
    const attrStats = attributeEngine.getStats(attributes);

    // Calculate consistency
    const history = await taskEngine.getCompletionHistory(profile.reEvalIntervalDays || 7);
    const consistencyScore = aiResult?.consistencyScore || history.recentRate;
    const completionRate = aiResult?.taskCompletionRate || history.recentRate;

    // Determine new rank
    const newRank = aiResult?.recommendedRank ||
      rankEngine.evaluateRank(attrStats.totalXP, completionRate, consistencyScore);

    // Update rank
    const rankResult = await rankEngine.updateRank(profile, newRank, {
      totalXP: attrStats.totalXP,
      completionRate,
      consistencyScore,
    });

    // Record re-evaluation
    const reEval = {
      id: generateId(),
      triggeredAt: new Date().toISOString(),
      oldRank: rankResult.oldRank || profile.currentRank,
      newRank: newRank,
      taskCompletionRate: completionRate,
      consistencyScore: consistencyScore,
      aiSummary: aiResult?.summary || 'Re-evaluation complete.',
      aiRecommendations: aiResult?.recommendations || '',
    };
    await storage.put('reEvaluations', reEval);

    // Update profile for next re-eval
    const updatedProfile = await storage.get('profile', profile.id);
    updatedProfile.lastReEvalAt = new Date().toISOString();
    updatedProfile.nextReEvalAt = this._calcNextReEval(updatedProfile.reEvalIntervalDays);
    await storage.put('profile', updatedProfile);
    state.set('profile', updatedProfile);

    return {
      reEval,
      rankChanged: rankResult.changed,
      newRank,
      oldRank: rankResult.oldRank,
      completionRate,
      consistencyScore,
      aiSummary: aiResult?.summary,
      aiRecommendations: aiResult?.recommendations,
      adjustedTasks: aiResult?.adjustedTasks || [],
    };
  }

  _calcNextReEval(intervalDays) {
    const next = new Date();
    next.setDate(next.getDate() + (intervalDays || 7));
    return next.toISOString();
  }

  // Get past re-evaluations
  async getHistory() {
    const history = await storage.getAll('reEvaluations');
    history.sort((a, b) => new Date(b.triggeredAt) - new Date(a.triggeredAt));
    return history;
  }
}

export const reEvalEngine = new ReEvalEngine();
