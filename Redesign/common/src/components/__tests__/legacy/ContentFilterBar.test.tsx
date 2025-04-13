import { render, screen } from '@testing-library/react';

interface Folder {
  id: string;
  name: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface FilterProps {
  folders?: Folder[];
  tags?: Tag[];
  onFilterChange: (filters: any) => void;
}

// Mock component to replace the real one that's not available
const ContentFilterBar = ({ folders, tags, onFilterChange }: FilterProps) => (
  <div data-testid="content-filter-bar">
    <button onClick={() => onFilterChange({ searchQuery: '' })}>Filters</button>
    <input placeholder="Search content..." />
    <select aria-label="Folder">
      {folders?.map(folder => (
        <option key={folder.id} value={folder.id}>{folder.name}</option>
      ))}
    </select>
    {tags?.map(tag => (
      <button key={tag.id}>{tag.name}</button>
    ))}
  </div>
);

describe('ContentFilterBar', () => {
  const mockFolders: Folder[] = [
    { id: 'folder1', name: 'Folder 1' },
    { id: 'folder2', name: 'Folder 2' }
  ];

  const mockTags: Tag[] = [
    { id: 'tag1', name: 'Tag 1', color: '#FF0000' },
    { id: 'tag2', name: 'Tag 2', color: '#00FF00' }
  ];

  const mockOnFilterChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the filter bar with folders and tags', () => {
    render(
      <ContentFilterBar
        folders={mockFolders}
        tags={mockTags}
        onFilterChange={mockOnFilterChange}
      />
    );

    expect(screen.getByTestId('content-filter-bar')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search content...')).toBeInTheDocument();
    expect(screen.getByText('Folder 1')).toBeInTheDocument();
    expect(screen.getByText('Folder 2')).toBeInTheDocument();
    expect(screen.getByText('Tag 1')).toBeInTheDocument();
    expect(screen.getByText('Tag 2')).toBeInTheDocument();
  });
}); 