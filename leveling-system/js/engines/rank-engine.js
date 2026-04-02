// ============================================
// SOLO LEVELING SYSTEM — Rank Engine
// ============================================

import { storage, generateId } from '../services/storage.js';
import { state } from '../state.js';

const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'];

// Rebalanced: With ~17.5 XP/day (5 tasks * 3.5 avg XP = 17.5/day = ~525/month)
// E -> D: ~2 months      | D -> C: ~7 months cumulative
// C -> B: ~17 months     | B -> A: ~48 months (extremely hard)
// A -> S: ~114 months    (near impossible — years of relentless dedication)
const RANK_THRESHOLDS = {
  E: { minXP: 0,     minCompletion: 0,  minConsistency: 0 },
  D: { minXP: 1000,  minCompletion: 40, minConsistency: 40 },
  C: { minXP: 3500,  minCompletion: 55, minConsistency: 55 },
  B: { minXP: 9000,  minCompletion: 70, minConsistency: 70 },
  A: { minXP: 25000, minCompletion: 90, minConsistency: 90 },
  S: { minXP: 60000, minCompletion: 97, minConsistency: 97 },
};

const RANK_NAMES = {
  E: 'E-Rank Hunter',
  D: 'D-Rank Hunter',
  C: 'C-Rank Hunter',
  B: 'B-Rank Hunter',
  A: 'A-Rank Hunter',
  S: 'S-Rank Hunter',
};

export class RankEngine {
  getRanks() { return RANKS; }
  getRankName(rank) { return RANK_NAMES[rank] || 'Unknown'; }
  getThresholds(rank) { return RANK_THRESHOLDS[rank]; }

  // Evaluate what rank the player qualifies for
  evaluateRank(totalXP, completionRate, consistencyScore) {
    let qualifiedRank = 'E';
    for (const rank of RANKS) {
      const th = RANK_THRESHOLDS[rank];
      if (totalXP >= th.minXP && completionRate >= th.minCompletion && consistencyScore >= th.minConsistency) {
        qualifiedRank = rank;
      }
    }
    return qualifiedRank;
  }

  // Get progress toward next rank
  getNextRankProgress(currentRank, totalXP, completionRate, consistencyScore) {
    const idx = RANKS.indexOf(currentRank);
    if (idx >= RANKS.length - 1) return { nextRank: null, progress: 100, requirements: null };
    const nextRank = RANKS[idx + 1];
    const th = RANK_THRESHOLDS[nextRank];
    const xpProgress = Math.min(100, (totalXP / th.minXP) * 100);
    const compProgress = Math.min(100, (completionRate / th.minCompletion) * 100);
    const consProgress = Math.min(100, (consistencyScore / th.minConsistency) * 100);
    const avgProgress = Math.round((xpProgress + compProgress + consProgress) / 3);
    return {
      nextRank,
      progress: avgProgress,
      requirements: {
        xp: { current: totalXP, needed: th.minXP, met: totalXP >= th.minXP },
        completion: { current: completionRate, needed: th.minCompletion, met: completionRate >= th.minCompletion },
        consistency: { current: consistencyScore, needed: th.minConsistency, met: consistencyScore >= th.minConsistency },
      },
    };
  }

  // Update rank and record history
  async updateRank(profile, newRank, stats) {
    const oldRank = profile.currentRank;
    if (oldRank === newRank) return { changed: false, rank: newRank };
    profile.currentRank = newRank;
    await storage.put('profile', profile);
    const historyEntry = {
      id: generateId(),
      rank: newRank,
      previousRank: oldRank,
      totalXP: stats.totalXP,
      completionRate: stats.completionRate,
      consistencyScore: stats.consistencyScore,
      timestamp: new Date().toISOString(),
      summary: `Rank ${this.getRankIndex(newRank) < this.getRankIndex(oldRank) ? 'decreased' : 'increased'} from ${oldRank} to ${newRank}`,
    };
    await storage.put('rankHistory', historyEntry);
    const rankHistory = await storage.getAll('rankHistory');
    state.set('rankHistory', rankHistory);
    state.set('profile', profile);
    return { changed: true, rank: newRank, oldRank, historyEntry };
  }

  // Get rank history
  async getRankHistory() {
    const history = await storage.getAll('rankHistory');
    history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return history;
  }

  getRankIndex(rank) { return RANKS.indexOf(rank); }

  isRankUp(oldRank, newRank) {
    return RANKS.indexOf(newRank) > RANKS.indexOf(oldRank);
  }
}

export const rankEngine = new RankEngine();
