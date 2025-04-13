import { OfflineQueue, QueueActionType } from '@vizora/common';
import { VizoraSocketClient } from '@vizora/common';
import { toast } from 'react-hot-toast';

// TODO: Phase 4 - Enhance offline queue with conflict resolution strategies and 
// implement proper synchronization protocol with server-side validation.
export class OfflineQueueService {
  private queue: OfflineQueue;
  private socket: VizoraSocketClient;
  private isProcessing: boolean = false;

  constructor(socket: VizoraSocketClient) {
    this.socket = socket;
    this.queue = new OfflineQueue(localStorage, 'vizora_display_queue', {
      maxQueueSize: 100,
      maxRetries: 3,
      retryDelay: 5000,
      deduplicationWindow: 60000,
    });

    // Listen for socket connection status
    this.socket.on('connect', () => {
      this.processQueue();
    });

    this.socket.on('disconnect', () => {
      toast.error('Connection lost. Changes will be queued for retry.');
    });
  }

  async enqueueContentUpdate(contentId: string): Promise<void> {
    await this.queue.enqueue(QueueActionType.CONTENT_UPDATE, { contentId });
    this.processQueue();
  }

  async enqueueScheduleUpdate(scheduleId: string): Promise<void> {
    await this.queue.enqueue(QueueActionType.SCHEDULE_UPDATE, { scheduleId });
    this.processQueue();
  }

  async enqueueStatusReport(status: Record<string, unknown>): Promise<void> {
    await this.queue.enqueue(QueueActionType.STATUS_REPORT, status);
    this.processQueue();
  }

  async enqueueHealthUpdate(health: Record<string, unknown>): Promise<void> {
    await this.queue.enqueue(QueueActionType.HEALTH_UPDATE, health);
    this.processQueue();
  }

  async enqueueSettingsUpdate(settings: Record<string, unknown>): Promise<void> {
    await this.queue.enqueue(QueueActionType.SETTINGS_UPDATE, settings);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || !this.socket.connected) {
      return;
    }

    this.isProcessing = true;

    try {
      await this.queue.processQueue(async (action) => {
        switch (action.type) {
          case QueueActionType.CONTENT_UPDATE:
            await this.socket.emit('content:update', action.payload);
            break;
          case QueueActionType.SCHEDULE_UPDATE:
            await this.socket.emit('schedule:update', action.payload);
            break;
          case QueueActionType.STATUS_REPORT:
            await this.socket.emit('status:report', action.payload);
            break;
          case QueueActionType.HEALTH_UPDATE:
            await this.socket.emit('health:update', action.payload);
            break;
          case QueueActionType.SETTINGS_UPDATE:
            await this.socket.emit('settings:update', action.payload);
            break;
        }
      });
    } catch (error) {
      console.error('Error processing queue:', error);
      toast.error('Failed to process some queued actions');
    } finally {
      this.isProcessing = false;
    }
  }

  getQueueStatus() {
    return this.queue.getQueueStatus();
  }

  clearQueue() {
    this.queue.clearQueue();
  }
} 