import { render, waitFor } from '@testing-library/react';
import { DisplayClient } from '../DisplayClient';
import type { Playlist } from '../lib/types';

const preloadItems = jest.fn();
const updatePlaylist = jest.fn();
let capturedPlaylistUpdate: ((playlist: Playlist) => void) | undefined;

jest.mock('../hooks/useBrowserCache', () => ({
  useBrowserCache: () => ({ preloadItems }),
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
  clearCredentials: jest.fn(),
}));

jest.mock('../hooks/useDeviceConnection', () => ({
  useDeviceConnection: (options: any) => {
    capturedPlaylistUpdate = options.onPlaylistUpdate;
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
  beforeEach(() => {
    jest.clearAllMocks();
    capturedPlaylistUpdate = undefined;
    Object.defineProperty(window, 'location', {
      value: new URL('https://display.example.test/display'),
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
    expect(preloadItems).toHaveBeenCalledWith([
      '/api/v1/device-content/content-1/file?token=device-token-123',
    ]);
  });
});
