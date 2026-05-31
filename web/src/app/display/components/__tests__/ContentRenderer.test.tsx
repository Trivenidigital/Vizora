import { render, screen } from '@testing-library/react';
import { ContentRenderer } from '../ContentRenderer';

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
});
