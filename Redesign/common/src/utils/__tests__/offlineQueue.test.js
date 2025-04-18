import { OfflineQueue, QueueActionType, QueuePriority } from '../offlineQueue';
describe('OfflineQueue', () => {
    let mockStorage;
    let queue;
    beforeEach(() => {
        mockStorage = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn(),
            clear: jest.fn(),
            length: 0,
            key: jest.fn(),
        };
        queue = new OfflineQueue(mockStorage);
    });
    describe('enqueue', () => {
        it('adds action to queue with correct priority', async () => {
            const action = await queue.enqueue(QueueActionType.CONTENT_UPDATE, {
                contentId: '123',
            });
            expect(action.type).toBe(QueueActionType.CONTENT_UPDATE);
            expect(action.priority).toBe(QueuePriority.HIGH);
            expect(action.retryCount).toBe(0);
            expect(mockStorage.setItem).toHaveBeenCalled();
        });
        it('deduplicates actions within window', async () => {
            const payload = { contentId: '123' };
            await queue.enqueue(QueueActionType.CONTENT_UPDATE, payload);
            await queue.enqueue(QueueActionType.CONTENT_UPDATE, payload);
            const status = queue.getQueueStatus();
            expect(status.byType[QueueActionType.CONTENT_UPDATE]).toBe(1);
        });
        it('respects max queue size', async () => {
            const config = { maxQueueSize: 2 };
            queue = new OfflineQueue(mockStorage, 'test', config);
            await queue.enqueue(QueueActionType.CONTENT_UPDATE, { id: 1 });
            await queue.enqueue(QueueActionType.CONTENT_UPDATE, { id: 2 });
            await queue.enqueue(QueueActionType.CONTENT_UPDATE, { id: 3 });
            expect(queue.getQueueLength()).toBe(2);
        });
        it('maintains priority order', async () => {
            await queue.enqueue(QueueActionType.HEALTH_UPDATE, {});
            await queue.enqueue(QueueActionType.CONTENT_UPDATE, {});
            await queue.enqueue(QueueActionType.STATUS_REPORT, {});
            const status = queue.getQueueStatus();
            expect(status.byPriority[QueuePriority.HIGH]).toBe(1);
            expect(status.byPriority[QueuePriority.MEDIUM]).toBe(1);
            expect(status.byPriority[QueuePriority.LOW]).toBe(1);
        });
    });
    describe('processQueue', () => {
        it('processes actions in priority order', async () => {
            const processed = [];
            const processor = async (action) => {
                processed.push(action.type);
            };
            await queue.enqueue(QueueActionType.HEALTH_UPDATE, {});
            await queue.enqueue(QueueActionType.CONTENT_UPDATE, {});
            await queue.enqueue(QueueActionType.STATUS_REPORT, {});
            await queue.processQueue(processor);
            expect(processed).toEqual([
                QueueActionType.CONTENT_UPDATE,
                QueueActionType.STATUS_REPORT,
                QueueActionType.HEALTH_UPDATE,
            ]);
        });
        it('retries failed actions', async () => {
            let attempts = 0;
            const processor = async () => {
                attempts++;
                if (attempts < 2) {
                    throw new Error('Failed');
                }
            };
            await queue.enqueue(QueueActionType.CONTENT_UPDATE, {});
            await queue.processQueue(processor);
            expect(attempts).toBe(2);
        });
        it('respects max retries', async () => {
            const config = { maxRetries: 2 };
            queue = new OfflineQueue(mockStorage, 'test', config);
            let attempts = 0;
            const processor = async () => {
                attempts++;
                throw new Error('Failed');
            };
            await queue.enqueue(QueueActionType.CONTENT_UPDATE, {});
            await queue.processQueue(processor);
            expect(attempts).toBe(2);
            expect(queue.getQueueLength()).toBe(0);
        });
        it('respects retry delay', async () => {
            const config = { retryDelay: 1000 };
            queue = new OfflineQueue(mockStorage, 'test', config);
            let attempts = 0;
            const processor = async () => {
                attempts++;
                throw new Error('Failed');
            };
            await queue.enqueue(QueueActionType.CONTENT_UPDATE, {});
            await queue.processQueue(processor);
            expect(attempts).toBe(1);
        });
    });
    describe('persistence', () => {
        it('loads queue from storage on initialization', () => {
            const storedQueue = [
                {
                    id: '1',
                    type: QueueActionType.CONTENT_UPDATE,
                    priority: QueuePriority.HIGH,
                    payload: {},
                    timestamp: Date.now(),
                    retryCount: 0,
                },
            ];
            jest.spyOn(mockStorage, 'getItem').mockReturnValue(JSON.stringify(storedQueue));
            queue = new OfflineQueue(mockStorage);
            expect(queue.getQueueLength()).toBe(1);
        });
        it('saves queue to storage on changes', async () => {
            await queue.enqueue(QueueActionType.CONTENT_UPDATE, {});
            expect(mockStorage.setItem).toHaveBeenCalled();
        });
    });
    describe('queue status', () => {
        it('provides accurate queue statistics', async () => {
            await queue.enqueue(QueueActionType.CONTENT_UPDATE, {});
            await queue.enqueue(QueueActionType.HEALTH_UPDATE, {});
            await queue.enqueue(QueueActionType.STATUS_REPORT, {});
            const status = queue.getQueueStatus();
            expect(status.total).toBe(3);
            expect(status.byType[QueueActionType.CONTENT_UPDATE]).toBe(1);
            expect(status.byType[QueueActionType.HEALTH_UPDATE]).toBe(1);
            expect(status.byType[QueueActionType.STATUS_REPORT]).toBe(1);
        });
    });
});
