import type { Content, ScheduleItem, DisplayStatus, DisplaySettings } from '../../types';
export declare class MockVizoraSocketClient {
    private listeners;
    private connected;
    connect: import("vitest").Mock<any, any>;
    disconnect: import("vitest").Mock<any, any>;
    on: import("vitest").Mock<any, any>;
    off: import("vitest").Mock<any, any>;
    emit: import("vitest").Mock<any, any>;
    mockEmit(event: string, data: any): void;
    mockError(error: Error): void;
    mockStatusUpdate(status: DisplayStatus): void;
    mockSettingsUpdate(settings: DisplaySettings): void;
    mockScheduleUpdate(schedule: ScheduleItem[]): void;
    mockContentUpdate(content: Content): void;
    isConnected(): boolean;
}
export declare const createMockSocketClient: () => MockVizoraSocketClient;
