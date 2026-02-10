import { render, screen, fireEvent } from '@testing-library/react';
import FolderBreadcrumb from '../FolderBreadcrumb';

// Mock the Icon component
jest.mock('@/theme/icons', () => ({
  Icon: ({ name, size, className }: { name: string; size: string; className?: string }) => (
    <span data-testid={`icon-${name}`} data-size={size} className={className}>
      {name}
    </span>
  ),
}));

describe('FolderBreadcrumb', () => {
  const mockFolders = [
    {
      id: 'folder-1',
      name: 'Marketing',
      parentId: null,
      organizationId: 'org-1',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      children: [
        {
          id: 'folder-2',
          name: 'Banners',
          parentId: 'folder-1',
          organizationId: 'org-1',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
          children: [
            {
              id: 'folder-3',
              name: 'Summer',
              parentId: 'folder-2',
              organizationId: 'org-1',
              createdAt: '2024-01-01',
              updatedAt: '2024-01-01',
            },
          ],
        },
      ],
    },
    {
      id: 'folder-4',
      name: 'Videos',
      parentId: null,
      organizationId: 'org-1',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
  ];

  const mockOnNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders "All Content" root button', () => {
    render(
      <FolderBreadcrumb
        folders={mockFolders}
        currentFolderId={null}
        onNavigate={mockOnNavigate}
      />
    );
    expect(screen.getByText('All Content')).toBeInTheDocument();
  });

  it('renders folder icon', () => {
    render(
      <FolderBreadcrumb
        folders={mockFolders}
        currentFolderId={null}
        onNavigate={mockOnNavigate}
      />
    );
    expect(screen.getByTestId('icon-folder')).toBeInTheDocument();
  });

  it('renders breadcrumb navigation with aria-label', () => {
    render(
      <FolderBreadcrumb
        folders={mockFolders}
        currentFolderId={null}
        onNavigate={mockOnNavigate}
      />
    );
    expect(screen.getByLabelText('Breadcrumb')).toBeInTheDocument();
  });

  it('renders no folder path when currentFolderId is null', () => {
    render(
      <FolderBreadcrumb
        folders={mockFolders}
        currentFolderId={null}
        onNavigate={mockOnNavigate}
      />
    );
    expect(screen.getByText('All Content')).toBeInTheDocument();
    expect(screen.queryByText('Marketing')).not.toBeInTheDocument();
  });

  it('renders folder path for first-level folder', () => {
    render(
      <FolderBreadcrumb
        folders={mockFolders}
        currentFolderId="folder-1"
        onNavigate={mockOnNavigate}
      />
    );
    expect(screen.getByText('All Content')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
  });

  it('renders full breadcrumb path for deeply nested folder', () => {
    render(
      <FolderBreadcrumb
        folders={mockFolders}
        currentFolderId="folder-3"
        onNavigate={mockOnNavigate}
      />
    );
    expect(screen.getByText('All Content')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    expect(screen.getByText('Banners')).toBeInTheDocument();
    expect(screen.getByText('Summer')).toBeInTheDocument();
  });

  it('calls onNavigate with null when "All Content" is clicked', () => {
    render(
      <FolderBreadcrumb
        folders={mockFolders}
        currentFolderId="folder-1"
        onNavigate={mockOnNavigate}
      />
    );
    fireEvent.click(screen.getByText('All Content'));
    expect(mockOnNavigate).toHaveBeenCalledWith(null);
  });

  it('calls onNavigate with folder id when folder in path is clicked', () => {
    render(
      <FolderBreadcrumb
        folders={mockFolders}
        currentFolderId="folder-3"
        onNavigate={mockOnNavigate}
      />
    );
    fireEvent.click(screen.getByText('Marketing'));
    expect(mockOnNavigate).toHaveBeenCalledWith('folder-1');
  });

  it('handles unknown folder id gracefully', () => {
    render(
      <FolderBreadcrumb
        folders={mockFolders}
        currentFolderId="nonexistent-folder"
        onNavigate={mockOnNavigate}
      />
    );
    // Should still render root
    expect(screen.getByText('All Content')).toBeInTheDocument();
  });

  it('renders empty folders array without error', () => {
    render(
      <FolderBreadcrumb
        folders={[]}
        currentFolderId={null}
        onNavigate={mockOnNavigate}
      />
    );
    expect(screen.getByText('All Content')).toBeInTheDocument();
  });
});
