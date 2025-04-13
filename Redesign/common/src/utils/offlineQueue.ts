import { z } from 'zod';

// TODO: Phase 4 - Improve queue persistence with a more reliable storage mechanism.
// Consider using a dedicated database like IndexedDB with encryption for sensitive data
// and implement proper recovery mechanisms for queue corruption.

// Action types and priorities
export enum QueueActionType {
  CONTENT_UPDATE = 'content:update',
  SCHEDULE_UPDATE = 'schedule:update',
  HEALTH_UPDATE = 'health:update',
  STATUS_REPORT = 'status:report',
  SETTINGS_UPDATE = 'settings:update',
}

export enum QueuePriority {
  HIGH = 0,    // Content and schedule updates
  MEDIUM = 1,  // Status reports
  LOW = 2,     // Health updates
}

// Action schema for validation
export const QueueActionSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(QueueActionType),
  priority: z.nativeEnum(QueuePriority),
  payload: z.record(z.unknown()),
  timestamp: z.number(),
  retryCount: z.number(),
  lastAttempt: z.number().optional(),
});

export type QueueAction = z.infer<typeof QueueActionSchema>;

// Queue configuration
const QueueConfigSchema = z.object({
  maxQueueSize: z.number().optional(),
  maxRetries: z.number().optional(),
  retryDelay: z.number().optional(),
  deduplicationWindow: z.number().optional(),
});

type QueueConfig = z.infer<typeof QueueConfigSchema>;

interface QueueStatus {
  total: number;
  byType: Record<QueueActionType, number>;
  byPriority: Record<QueuePriority, number>;
  oldestAction: number | null;
  newestAction: number | null;
}

export class OfflineQueue {
  private queue: QueueAction[] = [];
  private isProcessing: boolean = false;
  private config: Required<QueueConfig>;
  private storage: Storage;
  private storageKey: string;

  constructor(
    storage: Storage,
    storageKey: string = 'offline_queue',
    config: QueueConfig = {}
  ) {
    this.storage = storage;
    this.storageKey = storageKey;
    this.config = {
      maxQueueSize: 1000,
      maxRetries: 3,
      retryDelay: 5000,
      deduplicationWindow: 60000,
      ...config,
    };
    this.loadQueue();
  }

  private loadQueue(): void {
    const stored = this.storage.getItem(this.storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.queue = parsed.map((action: unknown) => QueueActionSchema.parse(action));
      } catch (error) {
        console.error('Failed to load queue from storage:', error);
        this.queue = [];
      }
    }
  }

  private saveQueue(): void {
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save queue to storage:', error);
    }
  }

  private getPriority(type: QueueActionType): QueuePriority {
    switch (type) {
      case QueueActionType.CONTENT_UPDATE:
      case QueueActionType.SCHEDULE_UPDATE:
        return QueuePriority.HIGH;
      case QueueActionType.STATUS_REPORT:
      case QueueActionType.HEALTH_UPDATE:
        return QueuePriority.MEDIUM;
      case QueueActionType.SETTINGS_UPDATE:
        return QueuePriority.LOW;
      default:
        return QueuePriority.MEDIUM;
    }
  }

  private isDuplicate(action: QueueAction): boolean {
    const window = this.config.deduplicationWindow;
    return this.queue.some(
      (existing) =>
        existing.type === action.type &&
        JSON.stringify(existing.payload) === JSON.stringify(action.payload) &&
        action.timestamp - existing.timestamp < window
    );
  }

  async enqueue(
    type: QueueActionType,
    payload: Record<string, unknown>
  ): Promise<QueueAction> {
    const action: QueueAction = {
      id: Math.random().toString(36).substring(7),
      type,
      priority: this.getPriority(type),
      payload,
      timestamp: Date.now(),
      retryCount: 0,
    };

    if (this.isDuplicate(action)) {
      return action;
    }

    if (this.queue.length >= this.config.maxQueueSize) {
      // Remove oldest low priority action
      const oldestLowPriorityIndex = this.queue.findIndex(
        (a) => a.priority === QueuePriority.LOW
      );
      if (oldestLowPriorityIndex !== -1) {
        this.queue.splice(oldestLowPriorityIndex, 1);
      } else {
        // If no low priority actions, remove oldest action
        this.queue.shift();
      }
    }

    this.queue.push(action);
    this.saveQueue();
    return action;
  }

  async processQueue(
    processor: (action: QueueAction) => Promise<void>
  ): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const sortedQueue = [...this.queue].sort((a, b) => a.priority - b.priority);
      
      for (const action of sortedQueue) {
        try {
          await processor(action);
          this.queue = this.queue.filter((a) => a.id !== action.id);
          this.saveQueue();
        } catch (error) {
          if (action.retryCount >= this.config.maxRetries) {
            this.queue = this.queue.filter((a) => a.id !== action.id);
            this.saveQueue();
            console.error(
              `Action ${action.type} failed after ${this.config.maxRetries} retries:`,
              error
            );
          } else {
            action.retryCount++;
            action.lastAttempt = Date.now() + this.config.retryDelay;
            this.saveQueue();
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getQueueStatus(): QueueStatus {
    const byType: Record<QueueActionType, number> = {
      [QueueActionType.CONTENT_UPDATE]: 0,
      [QueueActionType.SCHEDULE_UPDATE]: 0,
      [QueueActionType.STATUS_REPORT]: 0,
      [QueueActionType.HEALTH_UPDATE]: 0,
      [QueueActionType.SETTINGS_UPDATE]: 0,
    };

    const byPriority: Record<QueuePriority, number> = {
      [QueuePriority.HIGH]: 0,
      [QueuePriority.MEDIUM]: 0,
      [QueuePriority.LOW]: 0,
    };

    let oldestAction: number | null = null;
    let newestAction: number | null = null;

    this.queue.forEach((action) => {
      byType[action.type]++;
      byPriority[action.priority]++;

      if (!oldestAction || action.timestamp < oldestAction) {
        oldestAction = action.timestamp;
      }
      if (!newestAction || action.timestamp > newestAction) {
        newestAction = action.timestamp;
      }
    });

    return {
      total: this.queue.length,
      byType,
      byPriority,
      oldestAction,
      newestAction,
    };
  }

  clearQueue(): void {
    this.queue = [];
    this.saveQueue();
  }
} 