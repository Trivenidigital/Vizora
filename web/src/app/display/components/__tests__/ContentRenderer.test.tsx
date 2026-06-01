import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ContentRenderer } from '../ContentRenderer';
import { redactSensitiveUrl } from '../../lib/redact-sensitive-url';

describe('ContentRenderer', () => {
  const originalFetch = global.fetch;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalPlay = HTMLMediaElement.prototype.play;

  beforeEach(() => {
    global.fetch = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => 'blob:rendered-media'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: jest.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: originalRevokeObjectURL,
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: originalPlay,
    });
  });

  it('renders external HTTPS images directly instead of fetching them as blobs', () => {
    render(
      <ContentRenderer
        type="image"
        url="https://cdn.example.com/menu.png"
        name="Menu"
      />,
    );

    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('img', { name: 'Menu' })).toHaveAttribute(
      'src',
      'https://cdn.example.com/menu.png',
    );
  });

  it('renders external device-content lookalike images directly instead of treating them as protected media', () => {
    const getCachedUrl = jest.fn();
    render(
      <ContentRenderer
        type="image"
        url="https://evil.example/api/v1/device-content/content-1/file"
        name="Menu"
        getCachedUrl={getCachedUrl}
      />,
    );

    expect(global.fetch).not.toHaveBeenCalled();
    expect(getCachedUrl).not.toHaveBeenCalled();
    expect(screen.getByRole('img', { name: 'Menu' })).toHaveAttribute(
      'src',
      'https://evil.example/api/v1/device-content/content-1/file',
    );
  });

  it('redacts device tokens from load errors', () => {
    const onError = jest.fn();

    render(
      <ContentRenderer
        type="image"
        url="https://cdn.example.com/menu.png?token=device-jwt"
        name="Menu"
        onError={onError}
      />,
    );

    fireEvent.error(screen.getByRole('img', { name: 'Menu' }));

    expect(onError).toHaveBeenCalledWith(
      'load_error',
      'Image failed to load: https://cdn.example.com/menu.png?token=[redacted]',
    );
  });

  it('redacts token query params in generic strings', () => {
    expect(redactSensitiveUrl('url: /file?token=abc123&variant=original')).toBe(
      'url: /file?token=[redacted]&variant=original',
    );
  });

  it('uses cached protected images before falling back to a network blob fetch', async () => {
    const getCachedUrl = jest.fn().mockResolvedValue('blob:cached-image');

    render(
      <ContentRenderer
        type="image"
        url="/api/v1/device-content/content-1/file?token=device-jwt"
        name="Menu"
        getCachedUrl={getCachedUrl}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Menu' })).toHaveAttribute(
        'src',
        'blob:cached-image',
      );
    });

    expect(getCachedUrl).toHaveBeenCalledWith('/api/v1/device-content/content-1/file?token=device-jwt');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps protected image network fallback when the browser cache misses', async () => {
    const getCachedUrl = jest.fn().mockResolvedValue(null);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: jest.fn().mockResolvedValue(new Blob(['image'], { type: 'image/png' })),
    });

    render(
      <ContentRenderer
        type="image"
        url="/api/v1/device-content/content-1/file?token=device-jwt"
        name="Menu"
        getCachedUrl={getCachedUrl}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Menu' })).toHaveAttribute(
        'src',
        'blob:rendered-media',
      );
    });

    expect(getCachedUrl).toHaveBeenCalledWith('/api/v1/device-content/content-1/file?token=device-jwt');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/device-content/content-1/file?token=device-jwt',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('uses cached protected videos without issuing a duplicate fetch', async () => {
    let resolveCache!: (url: string) => void;
    const cachedUrlPromise = new Promise<string>((resolve) => {
      resolveCache = resolve;
    });
    const getCachedUrl = jest.fn(() => cachedUrlPromise);
    const { container } = render(
      <ContentRenderer
        type="video"
        url="/api/v1/device-content/content-1/file?token=device-jwt"
        name="Loop"
        getCachedUrl={getCachedUrl}
      />,
    );

    expect(container.querySelector('video')).toBeNull();
    expect(HTMLMediaElement.prototype.play as jest.Mock).not.toHaveBeenCalled();

    await act(async () => {
      resolveCache('blob:cached-video');
      await cachedUrlPromise;
    });

    await waitFor(() => {
      expect(container.querySelector('video')).toHaveAttribute('src', 'blob:cached-video');
    });

    expect(getCachedUrl).toHaveBeenCalledWith('/api/v1/device-content/content-1/file?token=device-jwt');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play as jest.Mock).toHaveBeenCalled();
  });
});
