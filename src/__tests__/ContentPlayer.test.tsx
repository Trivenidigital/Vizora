import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import ContentPlayer from '../components/ContentPlayer';

/**
 * Tests for the ContentPlayer component
 * 
 * This test suite verifies that the ContentPlayer component correctly:
 * - Renders image and video content
 * - Shows loading indicators
 * - Handles missing content
 * 
 * For testing, we use data-testid attributes to identify elements,
 * as this is more reliable than relying on DOM roles.
 */
describe('ContentPlayer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders image content correctly', () => {
    const content = {
      id: '1',
      title: 'Test Image',
      type: 'image' as const,
      url: 'https://example.com/test.jpg',
      duration: 10
    };

    render(<ContentPlayer content={content} />);

    expect(screen.getByTestId('content-player')).toBeInTheDocument();
    const image = screen.getByTestId('image-content');
    expect(image).toHaveAttribute('src', content.url);
    expect(image).toHaveAttribute('alt', content.title);
  });

  test('renders video content correctly', () => {
    const content = {
      id: '2',
      title: 'Test Video',
      type: 'video' as const,
      url: 'https://example.com/test.mp4',
      duration: 30
    };

    render(<ContentPlayer content={content} />);

    expect(screen.getByTestId('content-player')).toBeInTheDocument();
    const video = screen.getByTestId('video-content');
    expect(video).toHaveAttribute('src', content.url);
  });

  test('shows loading indicator before content loads', () => {
    const content = {
      id: '1',
      title: 'Test Image',
      type: 'image' as const,
      url: 'https://example.com/test.jpg',
      duration: 10
    };

    render(<ContentPlayer content={content} />);

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  test('shows no content message when no content is provided', () => {
    render(<ContentPlayer />);

    expect(screen.getByTestId('no-content')).toBeInTheDocument();
  });
}); 