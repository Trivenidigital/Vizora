import React from 'react';
import { render, screen } from '@testing-library/react';
import ContentOrganizationBadges from '../ContentOrganizationBadges';
import { Folder, Tag } from '../../types/organization';

describe('ContentOrganizationBadges', () => {
  const mockFolder: Folder = {
    id: 'folder1',
    name: 'Folder 1',
    parentId: undefined,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    owner: 'user1',
    contentCount: 5
  };

  const mockTags: Tag[] = [
    {
      id: 'tag1',
      name: 'Tag 1',
      color: '#FF0000',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      owner: 'user1',
      contentCount: 4
    },
    {
      id: 'tag2',
      name: 'Tag 2',
      color: '#00FF00',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      owner: 'user1',
      contentCount: 2
    }
  ];

  it('renders folder badge when folder is provided', () => {
    render(
      <ContentOrganizationBadges
        folder="Folder 1"
        tags={[]}
      />
    );

    const folderBadge = screen.getByText('Folder 1');
    expect(folderBadge).toBeInTheDocument();
    expect(folderBadge).toHaveClass('inline-flex', 'items-center', 'px-2', 'py-1', 'rounded-md', 'text-sm', 'font-medium', 'bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
  });

  it('renders tag badges when tags are provided', () => {
    const mockTags = [
      { id: '1', name: 'Tag 1', color: '#FF0000' },
      { id: '2', name: 'Tag 2', color: '#00FF00' }
    ];

    render(
      <ContentOrganizationBadges
        folder=""
        tags={mockTags}
      />
    );

    const tag1Badge = screen.getByText('Tag 1');
    const tag2Badge = screen.getByText('Tag 2');

    expect(tag1Badge).toBeInTheDocument();
    expect(tag2Badge).toBeInTheDocument();
    expect(tag1Badge).toHaveStyle({ color: '#FF0000' });
    expect(tag2Badge).toHaveStyle({ color: '#00FF00' });
  });

  it('renders both folder and tag badges when both are provided', () => {
    render(
      <ContentOrganizationBadges
        folder={mockFolder}
        tags={mockTags}
      />
    );

    expect(screen.getByText('Folder 1')).toBeInTheDocument();
    expect(screen.getByText('Tag 1')).toBeInTheDocument();
    expect(screen.getByText('Tag 2')).toBeInTheDocument();
  });

  it('renders nothing when neither folder nor tags are provided', () => {
    const { container } = render(
      <ContentOrganizationBadges
        folder=""
        tags={[]}
      />
    );

    expect(container.firstChild).toHaveClass('flex', 'flex-wrap', 'gap-2');
    expect(container.firstChild).toBeEmptyDOMElement();
  });

  it('renders folder badge with correct styling', () => {
    render(
      <ContentOrganizationBadges
        folder="Folder 1"
        tags={[]}
      />
    );

    const folderBadge = screen.getByText('Folder 1');
    expect(folderBadge).toHaveClass('inline-flex', 'items-center', 'px-2', 'py-1', 'rounded-md', 'text-sm', 'font-medium', 'bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
    expect(folderBadge).toHaveStyle({
      backgroundColor: '#f3f4f6',
      color: '#374151'
    });
  });

  it('renders tag badges with correct styling', () => {
    const mockTags = [
      { id: '1', name: 'Tag 1', color: '#FF0000' },
      { id: '2', name: 'Tag 2', color: '#00FF00' }
    ];

    render(
      <ContentOrganizationBadges
        folder=""
        tags={mockTags}
      />
    );

    const tag1Badge = screen.getByText('Tag 1');
    const tag2Badge = screen.getByText('Tag 2');

    expect(tag1Badge).toHaveStyle({
      color: '#FF0000'
    });
    expect(tag2Badge).toHaveStyle({
      color: '#00FF00'
    });
  });

  it('handles empty tags array', () => {
    render(
      <ContentOrganizationBadges
        folder={mockFolder}
        tags={[]}
      />
    );

    expect(screen.getByText('Folder 1')).toBeInTheDocument();
    expect(screen.queryByText('Tag 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Tag 2')).not.toBeInTheDocument();
  });

  it('handles undefined folder', () => {
    render(
      <ContentOrganizationBadges
        folder={undefined}
        tags={mockTags}
      />
    );

    expect(screen.queryByText('Folder 1')).not.toBeInTheDocument();
    expect(screen.getByText('Tag 1')).toBeInTheDocument();
    expect(screen.getByText('Tag 2')).toBeInTheDocument();
  });
}); 