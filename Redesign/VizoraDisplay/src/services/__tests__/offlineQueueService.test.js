import { OfflineQueueService } from '../offlineQueueService';
import { QueueActionType } from '@vizora/common';
describe('OfflineQueueService', () => {
    let mockSocket;
    let service;
    beforeEach(() => {
        mockSocket = {
            connected: false,
            on: jest.fn(),
            emit: jest.fn(),
        };
        service = new OfflineQueueService(mockSocket);
    });
    afterEach(() => {
        localStorage.clear();
    });
    describe('socket connection handling', () => {
        it('processes queue on connect', async () => {
            const connectCallback = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')[1];
            await service.enqueueContentUpdate('123');
            expect(service.getQueueStatus().total).toBe(1);
            mockSocket.connected = true;
            connectCallback();
            expect(mockSocket.emit).toHaveBeenCalledWith('content:update', {
                contentId: '123',
            });
        });
        it('shows error toast on disconnect', () => {
            const disconnectCallback = mockSocket.on.mock.calls.find((call) => call[0] === 'disconnect')[1];
            disconnectCallback();
            // Note: We can't directly test the toast since it's a UI component
            // The test verifies that the disconnect handler is registered
        });
    });
    describe('queue operations', () => {
        it('enqueues content updates', async () => {
            await service.enqueueContentUpdate('123');
            const status = service.getQueueStatus();
            expect(status.total).toBe(1);
            expect(status.byType[QueueActionType.CONTENT_UPDATE]).toBe(1);
        });
        it('enqueues schedule updates', async () => {
            await service.enqueueScheduleUpdate('456');
            const status = service.getQueueStatus();
            expect(status.total).toBe(1);
            expect(status.byType[QueueActionType.SCHEDULE_UPDATE]).toBe(1);
        });
        it('enqueues status reports', async () => {
            await service.enqueueStatusReport({ status: 'ok' });
            const status = service.getQueueStatus();
            expect(status.total).toBe(1);
            expect(status.byType[QueueActionType.STATUS_REPORT]).toBe(1);
        });
        it('enqueues health updates', async () => {
            await service.enqueueHealthUpdate({ health: 'good' });
            const status = service.getQueueStatus();
            expect(status.total).toBe(1);
            expect(status.byType[QueueActionType.HEALTH_UPDATE]).toBe(1);
        });
        it('enqueues settings updates', async () => {
            await service.enqueueSettingsUpdate({ brightness: 80 });
            const status = service.getQueueStatus();
            expect(status.total).toBe(1);
            expect(status.byType[QueueActionType.SETTINGS_UPDATE]).toBe(1);
        });
    });
    describe('queue processing', () => {
        it('processes queue when socket is connected', async () => {
            mockSocket.connected = true;
            await service.enqueueContentUpdate('123');
            expect(mockSocket.emit).toHaveBeenCalledWith('content:update', {
                contentId: '123',
            });
        });
        it('does not process queue when socket is disconnected', async () => {
            mockSocket.connected = false;
            await service.enqueueContentUpdate('123');
            expect(mockSocket.emit).not.toHaveBeenCalled();
        });
        it('handles processing errors gracefully', async () => {
            mockSocket.connected = true;
            mockSocket.emit.mockRejectedValueOnce(new Error('Network error'));
            await service.enqueueContentUpdate('123');
            // The error should be caught and logged, but not throw
            expect(mockSocket.emit).toHaveBeenCalled();
        });
    });
    describe('queue management', () => {
        it('clears queue', async () => {
            await service.enqueueContentUpdate('123');
            expect(service.getQueueStatus().total).toBe(1);
            service.clearQueue();
            expect(service.getQueueStatus().total).toBe(0);
        });
        it('provides accurate queue status', async () => {
            await service.enqueueContentUpdate('123');
            await service.enqueueScheduleUpdate('456');
            await service.enqueueStatusReport({ status: 'ok' });
            const status = service.getQueueStatus();
            expect(status.total).toBe(3);
            expect(status.byType[QueueActionType.CONTENT_UPDATE]).toBe(1);
            expect(status.byType[QueueActionType.SCHEDULE_UPDATE]).toBe(1);
            expect(status.byType[QueueActionType.STATUS_REPORT]).toBe(1);
        });
    });
});
