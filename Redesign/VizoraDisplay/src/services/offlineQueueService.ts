import { OfflineQueue, QueueActionType, QueueStatus } from '@vizora/common';
import { VizoraSocketClient } from '@vizora/common';
import { toast } from 'react-hot-toast';

// TODO: Phase 4 - Enhance offline queue with conflict resolution strategies and 
// implement proper synchronization protocol with server-side validation.
export class OfflineQueueService {
  private queue: OfflineQueue;
  private socket: any;
  private isProcessing: boolean = false;

  constructor(socket: any) {
    this.socket = socket;
    this.queue = new OfflineQueue(localStorage, 'vizora_display_queue', {
      maxQueueSize: 100,
      maxRetries: 3,
      retryDelay: 5000,
      deduplicationWindow: 60000,
    });

    // Add listeners back
    this.socket.on('connect');
    this.socket.on('disconnect');
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
    if (this.isProcessing || !this.socket.isConnected?.()) {
      return;
    }

    this.isProcessing = true;

    try {
      await this.queue.processQueue(async (action) => {
        switch (action.type) {
          case QueueActionType.CONTENT_UPDATE: await this.socket.emit('content:update'); break;
          case QueueActionType.SCHEDULE_UPDATE: await this.socket.emit('schedule:update'); break;
          case QueueActionType.STATUS_REPORT: await this.socket.emit('status:report'); break;
          case QueueActionType.HEALTH_UPDATE: await this.socket.emit('health:update'); break;
          case QueueActionType.SETTINGS_UPDATE: await this.socket.emit('settings:update'); break;
        }
      });
    } catch (error) {
      console.error('Error processing queue:', error);
      toast.error('Failed to process some queued actions');
    } finally {
      this.isProcessing = false;
    }
  }

  getQueueStatus(): QueueStatus {
    return this.queue.getQueueStatus();
  }

  clearQueue() {
    this.queue.clearQueue();
  }
} 