import { act, renderHook } from '@testing-library/react';
import { usePlaylistPlayer } from '../usePlaylistPlayer';

describe('usePlaylistPlayer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('treats pushed-content duration as minutes', () => {
    const playlist = {
      id: 'playlist-1',
      name: 'Default Loop',
      loopPlaylist: true,
      items: [
        {
          id: 'item-1',
          contentId: 'content-1',
          duration: 10,
          order: 0,
          content: {
            id: 'content-1',
            name: 'Default',
            type: 'image' as const,
            url: '/default.png',
          },
        },
      ],
    };
    const pushedContent = {
      id: 'emergency-1',
      name: 'Emergency',
      type: 'image' as const,
      url: '/emergency.png',
    };

    const { result } = renderHook(() => usePlaylistPlayer());

    act(() => {
      result.current.updatePlaylist(playlist);
      result.current.pushContent(pushedContent, 1);
    });

    expect(result.current.temporaryContent?.id).toBe('emergency-1');

    act(() => {
      jest.advanceTimersByTime(59000);
    });
    expect(result.current.temporaryContent?.id).toBe('emergency-1');

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.temporaryContent).toBeNull();
    expect(result.current.currentContentId).toBe('content-1');
  });
});
