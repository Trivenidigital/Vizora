import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FolderTree from '../FolderTree';
import { ContentFolder } from '@/lib/types';

// Mock the Icon component
jest.mock('@/theme/icons', () => ({
  Icon: ({ name, className }: { name: string; className?: string }) => (
    <span data-testid={`icon-${name}`} className={className}>
      {name}
    </span>
  ),
}));

describe('FolderTree', () => {
  const mockFolders: ContentFolder[] = [
    {
      id: 'folder-1',
      name: 'Marketing',
      parentId: null,
      organizationId: 'org-1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      contentCount: 5,
      children: [
        {
          id: 'folder-1-1',
          name: 'Q1 Campaign',
          parentId: 'folder-1',
          organizationId: 'org-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          contentCount: 3,
          children: [],
        },
      ],
    },
    {
      id: 'folder-2',
      name: 'Sales',
      parentId: null,
      organizationId: 'org-1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      contentCount: 10,
      children: [],
    },
  ];

  const defaultProps = {
    folders: mockFolders,
    selectedFolderId: null,
    onSelectFolder: jest.fn(),
    onCreateFolder: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the folder tree with all folders', () => {
    render(<FolderTree {...defaultProps} />);

    expect(screen.getByText('All Content')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();
  });

  it('should display content count badge', () => {
    render(<FolderTree {...defaultProps} />);

    expect(screen.getByText('5')).toBeInTheDocument(); // Marketing count
    expect(screen.getByText('10')).toBeInTheDocument(); // Sales count
  });

  it('should highlight selected folder', () => {
    render(<FolderTree {...defaultProps} selectedFolderId="folder-1" />);

    const marketingFolder = screen.getByText('Marketing').closest('div');
    expect(marketingFolder).toHaveClass('bg-brand/10');
  });

  it('should highlight "All Content" when no folder is selected', () => {
    render(<FolderTree {...defaultProps} selectedFolderId={null} />);

    const allContent = screen.getByText('All Content').closest('button');
    expect(allContent).toHaveClass('bg-brand/10');
    expect(allContent).toHaveAttribute('aria-current', 'true');
  });

  it('exposes the selected folder with aria-current and only on that folder', () => {
    render(<FolderTree {...defaultProps} selectedFolderId="folder-2" />);

    expect(screen.getByText('Sales').closest('button')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('Marketing').closest('button')).not.toHaveAttribute('aria-current');
    expect(screen.getByText('All Content').closest('button')).not.toHaveAttribute('aria-current');
  });

  it('names the expand toggle and reports its expanded state', () => {
    render(<FolderTree {...defaultProps} />);

    const toggle = screen.getByRole('button', { name: 'Expand folder Marketing' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Collapse folder Marketing' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('hides rename and delete actions when no handlers are given', () => {
    render(<FolderTree {...defaultProps} />);

    expect(screen.queryByRole('button', { name: /Rename folder/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete folder/ })).not.toBeInTheDocument();
  });

  it('calls rename and delete handlers with the folder, without selecting it', () => {
    const onSelectFolder = jest.fn();
    const onRenameFolder = jest.fn();
    const onDeleteFolder = jest.fn();
    render(
      <FolderTree
        {...defaultProps}
        onSelectFolder={onSelectFolder}
        onRenameFolder={onRenameFolder}
        onDeleteFolder={onDeleteFolder}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Rename folder Sales' }));
    expect(onRenameFolder).toHaveBeenCalledWith(expect.objectContaining({ id: 'folder-2', name: 'Sales' }));

    fireEvent.click(screen.getByRole('button', { name: 'Delete folder Marketing' }));
    expect(onDeleteFolder).toHaveBeenCalledWith(expect.objectContaining({ id: 'folder-1' }));

    expect(onSelectFolder).not.toHaveBeenCalled();
  });

  it('should call onSelectFolder when clicking a folder', () => {
    const onSelectFolder = jest.fn();
    render(<FolderTree {...defaultProps} onSelectFolder={onSelectFolder} />);

    fireEvent.click(screen.getByText('Marketing'));

    expect(onSelectFolder).toHaveBeenCalledWith('folder-1');
  });

  it('should call onSelectFolder with null when clicking "All Content"', () => {
    const onSelectFolder = jest.fn();
    render(<FolderTree {...defaultProps} onSelectFolder={onSelectFolder} />);

    fireEvent.click(screen.getByText('All Content'));

    expect(onSelectFolder).toHaveBeenCalledWith(null);
  });

  it('should expand folder to show children when clicking expand button', () => {
    render(<FolderTree {...defaultProps} />);

    // Initially child folder should not be visible
    expect(screen.queryByText('Q1 Campaign')).not.toBeInTheDocument();

    // Find and click the expand button for Marketing folder
    const marketingRow = screen.getByText('Marketing').closest('div')!;
    const expandButton = marketingRow.querySelector('button');
    fireEvent.click(expandButton!);

    // Now child folder should be visible
    expect(screen.getByText('Q1 Campaign')).toBeInTheDocument();
  });

  it('should collapse expanded folder when clicking expand button again', () => {
    render(<FolderTree {...defaultProps} />);

    // Expand Marketing folder
    const marketingRow = screen.getByText('Marketing').closest('div')!;
    const expandButton = marketingRow.querySelector('button');
    fireEvent.click(expandButton!);

    expect(screen.getByText('Q1 Campaign')).toBeInTheDocument();

    // Collapse Marketing folder
    fireEvent.click(expandButton!);

    expect(screen.queryByText('Q1 Campaign')).not.toBeInTheDocument();
  });

  it('should render "New Folder" button when onCreateFolder is provided', () => {
    render(<FolderTree {...defaultProps} />);

    expect(screen.getByText('New Folder')).toBeInTheDocument();
  });

  it('should call onCreateFolder when clicking "New Folder" button', () => {
    const onCreateFolder = jest.fn();
    render(<FolderTree {...defaultProps} onCreateFolder={onCreateFolder} />);

    fireEvent.click(screen.getByText('New Folder'));

    expect(onCreateFolder).toHaveBeenCalled();
  });

  it('should not render "New Folder" button when onCreateFolder is not provided', () => {
    render(
      <FolderTree
        folders={mockFolders}
        selectedFolderId={null}
        onSelectFolder={jest.fn()}
      />
    );

    expect(screen.queryByText('New Folder')).not.toBeInTheDocument();
  });

  it('should show "No folders yet" message when folders array is empty', () => {
    render(
      <FolderTree
        folders={[]}
        selectedFolderId={null}
        onSelectFolder={jest.fn()}
      />
    );

    expect(screen.getByText('No folders yet')).toBeInTheDocument();
  });

  it('should render header with "Folders" title', () => {
    render(<FolderTree {...defaultProps} />);

    expect(screen.getByText('Folders')).toBeInTheDocument();
  });
});
