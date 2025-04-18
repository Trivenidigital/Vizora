import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { VizoraDisplay } from '../components/VizoraDisplay';
import { VizoraSocketClient } from '../services/socketClient';
import { DisplayService } from '../services/displayService';
import { ContentService } from '../services/contentService';
// Mock socket client
vi.mock('../services/socketClient', () => ({
    VizoraSocketClient: vi.fn().mockImplementation(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
        removeAllListeners: vi.fn(),
        clear: vi.fn(),
    })),
}));
// Mock fetch
global.fetch = vi.fn();
vi.mock('../services/contentService', () => ({
    ContentService: vi.fn().mockImplementation(() => ({
        preloadContent: vi.fn(),
        getContent: vi.fn(),
        handleContentTransition: vi.fn(),
        isOffline: vi.fn(),
    })),
}));
describe('Content Management', () => {
    let socketClient;
    let displayService;
    beforeEach(() => {
        vi.clearAllMocks();
        socketClient = new VizoraSocketClient();
        displayService = new DisplayService(socketClient);
    });
    afterEach(() => {
        vi.clearAllMocks();
        socketClient.disconnect();
    });
    const mockContent = {
        id: '1',
        type: 'image',
        url: 'https://example.com/image.jpg',
        duration: 10,
    };
    it('loads and displays content correctly', async () => {
        const contentService = new ContentService();
        vi.mocked(contentService.getContent).mockResolvedValue(mockContent);
        render(_jsx(VizoraDisplay, {}));
        await waitFor(() => {
            expect(screen.getByTestId('content-container')).toHaveAttribute('data-content-id', '1');
        });
    });
    it('handles content preloading', async () => {
        const contentService = new ContentService();
        vi.mocked(contentService.getContent).mockResolvedValue(mockContent);
        render(_jsx(VizoraDisplay, {}));
        await waitFor(() => {
            expect(contentService.preloadContent).toHaveBeenCalledWith(mockContent);
        });
    });
    it('handles content transitions', async () => {
        const contentService = new ContentService();
        const nextContent = { ...mockContent, id: '2' };
        vi.mocked(contentService.getContent)
            .mockResolvedValueOnce(mockContent)
            .mockResolvedValueOnce(nextContent);
        render(_jsx(VizoraDisplay, {}));
        await waitFor(() => {
            expect(screen.getByTestId('content-container')).toHaveAttribute('data-content-id', '2');
        });
    });
    it('handles offline mode content', async () => {
        const contentService = new ContentService();
        vi.mocked(contentService.isOffline).mockReturnValue(true);
        render(_jsx(VizoraDisplay, {}));
        await waitFor(() => {
            expect(screen.getByTestId('offline-content')).toBeInTheDocument();
        });
    });
});
