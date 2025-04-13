import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ContentCard from '../ContentCard';
import { Content } from '../../types/content';
import { Folder, Tag } from '../../types/organization';

describe('ContentCard', () => {
  const mockContent: Content = {
    id: 'content1',
    name: 'Test Content',
    type: 'image',
    url: 'https://example.com/image.jpg',
    thumbnailUrl: 'https://example.com/thumbnail.jpg',
    size: 1024,
    status: 'ready',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    owner: 'user1',
    folder: {
      id: 'folder1',
      name: 'Folder 1',
      parentId: undefined,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      owner: 'user1',
      contentCount: 5
    },
    tags: [
      {
        id: 'tag1',
        name: 'Tag 1',
        color: '#FF0000',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        owner: 'user1',
        contentCount: 4
      }
    ]
  };

  const mockOnSelect = vi.fn();
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders content card with all information', () => {
    render(
      <ContentCard
        content={mockContent}
        isSelected={false}
        onSelect={mockOnSelect}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
    expect(screen.getByText('Folder 1')).toBeInTheDocument();
    expect(screen.getByText('Tag 1')).toBeInTheDocument();
    expect(screen.getByText('1 KB')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('handles selection checkbox click', () => {
    render(
      <ContentCard
        content={mockContent}
        isSelected={false}
        onSelect={mockOnSelect}
        onClick={mockOnClick}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(mockOnSelect).toHaveBeenCalledWith('content1', true);
  });

  it('handles content card click', () => {
    render(
      <ContentCard
        content={mockContent}
        isSelected={false}
        onSelect={mockOnSelect}
        onClick={mockOnClick}
      />
    );

    const card = screen.getByRole('button');
    fireEvent.click(card);

    expect(mockOnClick).toHaveBeenCalledWith(mockContent);
  });

  it('displays selected state correctly', () => {
    render(
      <ContentCard
        content={mockContent}
        isSelected={true}
        onSelect={mockOnSelect}
        onClick={mockOnClick}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('displays content type icon correctly', () => {
    render(
      <ContentCard
        content={mockContent}
        isSelected={false}
        onSelect={mockOnSelect}
        onClick={mockOnClick}
      />
    );

    const icon = screen.getByTestId('content-type-icon');
    expect(icon).toHaveAttribute('data-type', 'image');
  });

  it('displays thumbnail image correctly', () => {
    render(
      <ContentCard
        content={mockContent}
        isSelected={false}
        onSelect={mockOnSelect}
        onClick={mockOnClick}
      />
    );

    const thumbnail = screen.getByRole('img');
    expect(thumbnail).toHaveAttribute('src', 'https://example.com/thumbnail.jpg');
    expect(thumbnail).toHaveAttribute('alt', 'Test Content');
  });

  it('handles content without folder', () => {
    const contentWithoutFolder = {
      ...mockContent,
      folder: undefined
    };

    render(
      <ContentCard
        content={contentWithoutFolder}
        isSelected={false}
        onSelect={mockOnSelect}
        onClick={mockOnClick}
      />
    );

    expect(screen.queryByText('Folder 1')).not.toBeInTheDocument();
  });

  it('handles content without tags', () => {
    const contentWithoutTags = {
      ...mockContent,
      tags: []
    };

    render(
      <ContentCard
        content={contentWithoutTags}
        isSelected={false}
        onSelect={mockOnSelect}
        onClick={mockOnClick}
      />
    );

    expect(screen.queryByText('Tag 1')).not.toBeInTheDocument();
  });

  it('displays processing status correctly', () => {
    const processingContent: Content = {
      ...mockContent,
      status: 'processing'
    };

    render(
      <ContentCard
        content={processingContent}
        isSelected={false}
        onSelect={mockOnSelect}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText('Processing')).toBeInTheDocument();
  });

  it('displays error status correctly', () => {
    const errorContent: Content = {
      ...mockContent,
      status: 'error'
    };

    render(
      <ContentCard
        content={errorContent}
        isSelected={false}
        onSelect={mockOnSelect}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
  });
}); 