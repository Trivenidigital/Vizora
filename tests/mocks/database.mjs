/**
 * Mock database for tests
 */

// Mock data store
const db = {
  displays: new Map(),
  content: new Map(),
  schedules: new Map(),
  users: new Map()
};

// Display operations
export const displayOperations = {
  create: (data) => {
    const id = `display-${Date.now()}`;
    db.displays.set(id, { ...data, id });
    return Promise.resolve({ ...data, id });
  },
  
  findById: (id) => {
    const display = db.displays.get(id);
    return Promise.resolve(display || null);
  },
  
  findAll: () => {
    return Promise.resolve(Array.from(db.displays.values()));
  },
  
  update: (id, data) => {
    if (!db.displays.has(id)) {
      return Promise.reject(new Error('Display not found'));
    }
    const updated = { ...db.displays.get(id), ...data };
    db.displays.set(id, updated);
    return Promise.resolve(updated);
  },
  
  delete: (id) => {
    return Promise.resolve(db.displays.delete(id));
  }
};

// Content operations
export const contentOperations = {
  create: (data) => {
    const id = `content-${Date.now()}`;
    db.content.set(id, { ...data, id });
    return Promise.resolve({ ...data, id });
  },
  
  findById: (id) => {
    const content = db.content.get(id);
    return Promise.resolve(content || null);
  },
  
  findAll: () => {
    return Promise.resolve(Array.from(db.content.values()));
  },
  
  update: (id, data) => {
    if (!db.content.has(id)) {
      return Promise.reject(new Error('Content not found'));
    }
    const updated = { ...db.content.get(id), ...data };
    db.content.set(id, updated);
    return Promise.resolve(updated);
  },
  
  delete: (id) => {
    return Promise.resolve(db.content.delete(id));
  }
};

// Clear all data (useful for tests)
export const clearDatabase = () => {
  db.displays.clear();
  db.content.clear();
  db.schedules.clear();
  db.users.clear();
  return Promise.resolve();
}; 