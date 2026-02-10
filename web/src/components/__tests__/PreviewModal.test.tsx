import { render, screen } from '@testing-library/react';
import PreviewModal from '../PreviewModal';

jest.mock('../Modal', () => {
  return function MockModal({ isOpen, onClose, title, children }: any) {
    if (!isOpen) return null;
    return (
      <div data-testid="modal" role="dialog">
        <h3>{title}</h3>
        <button onClick={onClose}>Close</button>
        {children}
      </div>
    );
  };
});

describe('PreviewModal', () => {
  const baseContent = {
    id: 'c1',
    title: 'Test Content',
    type: 'image' as const,
    url: 'https://example.com/image.jpg',
    status: 'ready',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };

  it('renders nothing when content is null', () => {
    const { container } = render(
      <PreviewModal isOpen={true} onClose={jest.fn()} content={null} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <PreviewModal isOpen={false} onClose={jest.fn()} content={baseContent} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders image preview for image type', () => {
    render(
      <PreviewModal isOpen={true} onClose={jest.fn()} content={baseContent} />
    );
    const img = screen.getByAltText('Test Content');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  it('renders video preview for video type', () => {
    render(
      <PreviewModal
        isOpen={true}
        onClose={jest.fn()}
        content={{ ...baseContent, type: 'video', url: 'https://example.com/video.mp4' }}
      />
    );
    const video = document.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('controls');
  });

  it('renders link for url type', () => {
    render(
      <PreviewModal
        isOpen={true}
        onClose={jest.fn()}
        content={{ ...baseContent, type: 'url', url: 'https://example.com' }}
      />
    );
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
  });

  it('renders modal with content title', () => {
    render(
      <PreviewModal isOpen={true} onClose={jest.fn()} content={baseContent} />
    );
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });
});
