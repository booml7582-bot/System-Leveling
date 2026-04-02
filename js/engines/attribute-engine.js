// ============================================
// SOLO LEVELING SYSTEM — Attribute Engine
// ============================================

import { storage, generateId } from '../services/storage.js';
import { state } from '../state.js';

// XP Economy: Level up every 150 XP
// With tasks giving 2-5 XP (~3.5 avg), that's ~43 tasks = ~8 days to level up per attribute
// Since tasks reward multiple attributes, effective level-up rate is ~3-5 days
const XP_PER_LEVEL = 150;

export class AttributeEngine {
  // Create attributes from AI definitions
  async createAttributes(attrDefs) {
    const attributes = attrDefs.map(def => ({
      id: generateId(),
      name: def.name,
      icon: '',  // no emojis — use category-based styling
      currentValue: def.startingValue || 0,
      maxValue: def.maxValue || 10000,
      category: def.category || 'general',
      createdAt: new Date().toISOString(),
    }));
    await storage.putMany('attributes', attributes);
    state.set('attributes', attributes);
    return attributes;
  }

  // Award XP to an attribute
  async awardXP(attributeName, xpAmount) {
    const attributes = await storage.getAll('attributes');
    const attr = attributes.find(a => a.name.toLowerCase() === attributeName.toLowerCase());
    if (!attr) return null;

    const oldValue = attr.currentValue;
    const oldLevel = this.getLevel(oldValue);

    attr.currentValue = Math.min(attr.currentValue + xpAmount, attr.maxValue);

    const newLevel = this.getLevel(attr.currentValue);
    const leveledUp = newLevel > oldLevel;

    await storage.put('attributes', attr);
    state.set('attributes', attributes);

    return { attribute: attr, xpGained: xpAmount, leveledUp, oldLevel, newLevel };
  }

  // Process rewards from a completed task
  async processTaskRewards(task) {
    const results = [];
    for (const reward of (task.attributeRewards || [])) {
      const result = await this.awardXP(reward.attributeName, reward.xp);
      if (result) results.push(result);
    }
    return results;
  }

  // Get level from XP (every 100 XP = 1 level)
  getLevel(xp) {
    return Math.floor(xp / XP_PER_LEVEL) + 1;
  }

  // Get XP within current level
  getLevelProgress(xp) {
    return xp % XP_PER_LEVEL;
  }

  // Get XP needed for next level
  getXPToNextLevel(xp) {
    return XP_PER_LEVEL - (xp % XP_PER_LEVEL);
  }

  // Get progress percentage within current level
  getLevelProgressPercent(xp) {
    return Math.round((this.getLevelProgress(xp) / XP_PER_LEVEL) * 100);
  }

  // Get total attribute stats
  getStats(attributes) {
    if (!attributes || attributes.length === 0) return { totalXP: 0, avgLevel: 0, highest: null };
    const totalXP = attributes.reduce((sum, a) => sum + a.currentValue, 0);
    const avgLevel = Math.round(attributes.reduce((sum, a) => sum + this.getLevel(a.currentValue), 0) / attributes.length);
    const highest = attributes.reduce((max, a) => a.currentValue > (max?.currentValue || 0) ? a : max, null);
    return { totalXP, avgLevel, highest };
  }

  // Add a new attribute
  async addAttribute(name, icon, category) {
    const attr = {
      id: generateId(),
      name,
      icon: '',
      currentValue: 0,
      maxValue: 10000,
      category: category || 'general',
      createdAt: new Date().toISOString(),
    };
    await storage.put('attributes', attr);
    const attributes = await storage.getAll('attributes');
    state.set('attributes', attributes);
    return attr;
  }

  // Remove an attribute
  async removeAttribute(attrId) {
    await storage.delete('attributes', attrId);
    const attributes = await storage.getAll('attributes');
    state.set('attributes', attributes);
  }

  // Update an attribute
  async updateAttribute(attrId, updates) {
    const attr = await storage.get('attributes', attrId);
    if (!attr) return null;
    Object.assign(attr, updates);
    await storage.put('attributes', attr);
    const attributes = await storage.getAll('attributes');
    state.set('attributes', attributes);
    return attr;
  }
}

export const attributeEngine = new AttributeEngine();
