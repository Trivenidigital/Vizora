import { render, screen } from '@testing-library/react';
import { ContentScreen } from '../ContentScreen';

jest.mock('../ContentRenderer', () => ({
  ContentRenderer: ({ url, name, type, metadata, authenticateUrl, getCachedUrl }: any) => {
    const zoneUrl = metadata?.zones?.[0]?.resolvedContent?.url;
    return (
      <div
        data-testid="renderer"
        data-url={url}
        data-zone-url={zoneUrl && authenticateUrl ? authenticateUrl(zoneUrl) : zoneUrl}
        data-type={type}
        data-has-cache-resolver={typeof getCachedUrl === 'function' ? 'true' : 'false'}
      >
        {name}
      </div>
    );
  },
}));

describe('ContentScreen', () => {
  it('adds device token to same-origin protected device-content URLs', () => {
    render(
      <ContentScreen
        currentItem={{
          id: 'item-1',
          contentId: 'content-1',
          duration: 10,
          order: 0,
          content: {
            id: 'content-1',
            name: 'Menu',
            type: 'image',
            url: '/api/v1/device-content/content-1/file?version=1',
          },
        } as any}
        temporaryContent={null}
        onVideoEnded={jest.fn()}
        deviceToken="device-token"
      />,
    );

    expect(screen.getByTestId('renderer')).toHaveAttribute(
      'data-url',
      '/api/v1/device-content/content-1/file?version=1&token=device-token',
    );
  });

  it('does not leak device token to attacker-origin lookalike URLs', () => {
    render(
      <ContentScreen
        currentItem={{
          id: 'item-1',
          contentId: 'content-1',
          duration: 10,
          order: 0,
          content: {
            id: 'content-1',
            name: 'Menu',
            type: 'image',
            url: 'https://evil.example/api/v1/device-content/content-1/file',
          },
        } as any}
        temporaryContent={null}
        onVideoEnded={jest.fn()}
        deviceToken="device-token"
      />,
    );

    expect(screen.getByTestId('renderer')).toHaveAttribute(
      'data-url',
      'https://evil.example/api/v1/device-content/content-1/file',
    );
  });

  it('passes token authentication through to protected layout zone URLs', () => {
    const getCachedUrl = jest.fn();
    render(
      <ContentScreen
        currentItem={{
          id: 'item-1',
          contentId: 'layout-1',
          duration: 10,
          order: 0,
          content: {
            id: 'layout-1',
            name: 'Menu Layout',
            type: 'layout',
            url: '',
            metadata: {
              zones: [
                {
                  id: 'zone-1',
                  gridArea: '1 / 1 / 2 / 2',
                  resolvedContent: {
                    type: 'image',
                    name: 'Dish',
                    url: '/api/v1/device-content/content-2/file',
                  },
                },
              ],
            },
          },
        } as any}
        temporaryContent={null}
        onVideoEnded={jest.fn()}
        deviceToken="device-token"
        getCachedUrl={getCachedUrl}
      />,
    );

    expect(screen.getByTestId('renderer')).toHaveAttribute(
      'data-zone-url',
      '/api/v1/device-content/content-2/file?token=device-token',
    );
    expect(screen.getByTestId('renderer')).toHaveAttribute(
      'data-has-cache-resolver',
      'true',
    );
  });
});
