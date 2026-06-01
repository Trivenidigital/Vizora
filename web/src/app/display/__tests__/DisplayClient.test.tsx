import { render, waitFor } from '@testing-library/react';
import { DisplayClient } from '../DisplayClient';
import type { Playlist } from '../lib/types';

const mockPreloadItems = jest.fn();
const mockClearCache = jest.fn().mockResolvedValue(undefined);
const mockClearCredentials = jest.fn();
const updatePlaylist = jest.fn();
let capturedPlaylistUpdate: ((playlist: Playlist) => void) | undefined;
let capturedCommand: ((command: { type: string }) => void) | undefined;

jest.mock('../hooks/useBrowserCache', () => ({
  useBrowserCache: () => ({ preloadItems: mockPreloadItems, clearCache: mockClearCache }),
}));

jest.mock('../hooks/usePairing', () => ({
  usePairing: () => ({
    pairingCode: null,
    qrCode: null,
    credentials: {
      deviceToken: 'device-token-123',
      deviceId: 'display-1',
      organizationId: 'org-1',
    },
    isPairing: false,
    error: null,
    requestPairingCode: jest.fn(),
    resetPairing: jest.fn(),
    updateDeviceToken: jest.fn(),
  }),
  clearCredentials: () => mockClearCredentials(),
}));

jest.mock('../hooks/useDeviceConnection', () => ({
  useDeviceConnection: (options: any) => {
    capturedPlaylistUpdate = options.onPlaylistUpdate;
    capturedCommand = options.onCommand;
    return {
      status: 'connected',
      emitImpression: jest.fn(),
      emitContentError: jest.fn(),
    };
  },
}));

jest.mock('../hooks/usePlaylistPlayer', () => ({
  usePlaylistPlayer: () => ({
    updatePlaylist,
    pushContent: jest.fn(),
    currentItem: null,
    temporaryContent: null,
    currentContentId: null,
    handleVideoEnded: jest.fn(),
  }),
}));

jest.mock('../hooks/useFullscreen', () => ({
  useFullscreen: () => ({
    isFullscreen: false,
    toggleFullscreen: jest.fn(),
  }),
}));

jest.mock('../components/ContentScreen', () => ({
  ContentScreen: () => <div data-testid="content-screen" />,
}));

jest.mock('../components/StatusBar', () => ({
  StatusBar: () => <div data-testid="status-bar" />,
}));

jest.mock('../components/FullscreenButton', () => ({
  FullscreenButton: () => <button type="button">fullscreen</button>,
}));

describe('DisplayClient', () => {
  let reload: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedPlaylistUpdate = undefined;
    capturedCommand = undefined;
    reload = jest.fn();
    const location = new URL('https://display.example.test/display') as URL & {
      reload: jest.Mock;
    };
    location.reload = reload;
    Object.defineProperty(window, 'location', {
      value: location,
      writable: true,
    });
  });

  it('preloads authenticated device-content URLs after playlist updates', async () => {
    render(<DisplayClient />);

    await waitFor(() => expect(capturedPlaylistUpdate).toBeDefined());

    capturedPlaylistUpdate?.({
      id: 'playlist-1',
      name: 'Main',
      items: [
        {
          id: 'item-1',
          contentId: 'content-1',
          duration: 10,
          order: 0,
          content: {
            id: 'content-1',
            name: 'Video',
            type: 'video',
            url: '/api/v1/device-content/content-1/file',
          },
        },
      ],
    });

    expect(updatePlaylist).toHaveBeenCalled();
    expect(mockPreloadItems).toHaveBeenCalledWith([
      '/api/v1/device-content/content-1/file?token=device-token-123',
    ]);
  });

  it('clears browser media cache without deleting pairing credentials', async () => {
    render(<DisplayClient />);

    await waitFor(() => expect(capturedCommand).toBeDefined());

    capturedCommand?.({ type: 'clear_cache' });

    await waitFor(() => expect(mockClearCache).toHaveBeenCalledTimes(1));
    expect(mockClearCredentials).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
