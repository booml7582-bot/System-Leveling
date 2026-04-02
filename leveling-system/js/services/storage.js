// ============================================
// SOLO LEVELING SYSTEM — IndexedDB Storage
// ============================================

const DB_NAME = 'SoloLevelingSystem';
const DB_VERSION = 1;

const STORES = {
  profile: { keyPath: 'id' },
  attributes: { keyPath: 'id' },
  tasks: { keyPath: 'id', indexes: [{ name: 'status', keyPath: 'status' }, { name: 'dueDate', keyPath: 'dueDate' }, { name: 'createdAt', keyPath: 'createdAt' }] },
  rankHistory: { keyPath: 'id', indexes: [{ name: 'timestamp', keyPath: 'timestamp' }] },
  reEvaluations: { keyPath: 'id', indexes: [{ name: 'triggeredAt', keyPath: 'triggeredAt' }] },
  dailyLogs: { keyPath: 'id', indexes: [{ name: 'date', keyPath: 'date' }] },
  settings: { keyPath: 'id' },
};

class StorageService {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        Object.entries(STORES).forEach(([name, config]) => {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: config.keyPath });
            if (config.indexes) {
              config.indexes.forEach(idx => {
                store.createIndex(idx.name, idx.keyPath, { unique: false });
              });
            }
          }
        });
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  _transaction(storeName, mode = 'readonly') {
    const tx = this.db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    return { tx, store };
  }

  async put(storeName, data) {
    return new Promise((resolve, reject) => {
      const { tx, store } = this._transaction(storeName, 'readwrite');
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
    });
  }

  async get(storeName, id) {
    return new Promise((resolve, reject) => {
      const { tx, store } = this._transaction(storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      const { tx, store } = this._transaction(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
    });
  }

  async delete(storeName, id) {
    return new Promise((resolve, reject) => {
      const { tx, store } = this._transaction(storeName, 'readwrite');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clear(storeName) {
    return new Promise((resolve, reject) => {
      const { tx, store } = this._transaction(storeName, 'readwrite');
      const request = store.clear();
      request.onsuccess = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async putMany(storeName, items) {
    return new Promise((resolve, reject) => {
      const { tx, store } = this._transaction(storeName, 'readwrite');
      items.forEach(item => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const { tx, store } = this._transaction(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
    });
  }

  // Export all data
  async exportAll() {
    const data = {};
    for (const storeName of Object.keys(STORES)) {
      data[storeName] = await this.getAll(storeName);
    }
    return data;
  }

  // Import data
  async importAll(data) {
    for (const [storeName, items] of Object.entries(data)) {
      if (STORES[storeName] && Array.isArray(items)) {
        await this.clear(storeName);
        await this.putMany(storeName, items);
      }
    }
  }

  // Reset all data
  async resetAll() {
    for (const storeName of Object.keys(STORES)) {
      await this.clear(storeName);
    }
  }

  // Generate unique ID
  static generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }
}

export const storage = new StorageService();
export const generateId = StorageService.generateId;
