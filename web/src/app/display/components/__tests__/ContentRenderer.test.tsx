import { fireEvent, render, screen } from '@testing-library/react';
import { ContentRenderer } from '../ContentRenderer';
import { redactSensitiveUrl } from '../../lib/redact-sensitive-url';

describe('ContentRenderer', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
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
});
