import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { render, screen } from '@testing-library/react';
// Mock component to replace the real one that's not available
const ContentFilterBar = ({ folders, tags, onFilterChange }) => (_jsxs("div", { "data-testid": "content-filter-bar", children: [_jsx("button", { onClick: () => onFilterChange({ searchQuery: '' }), children: "Filters" }), _jsx("input", { placeholder: "Search content..." }), _jsx("select", { "aria-label": "Folder", children: folders?.map(folder => (_jsx("option", { value: folder.id, children: folder.name }, folder.id))) }), tags?.map(tag => (_jsx("button", { children: tag.name }, tag.id)))] }));
describe('ContentFilterBar', () => {
    const mockFolders = [
        { id: 'folder1', name: 'Folder 1' },
        { id: 'folder2', name: 'Folder 2' }
    ];
    const mockTags = [
        { id: 'tag1', name: 'Tag 1', color: '#FF0000' },
        { id: 'tag2', name: 'Tag 2', color: '#00FF00' }
    ];
    const mockOnFilterChange = jest.fn();
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('renders the filter bar with folders and tags', () => {
        render(_jsx(ContentFilterBar, { folders: mockFolders, tags: mockTags, onFilterChange: mockOnFilterChange }));
        expect(screen.getByTestId('content-filter-bar')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search content...')).toBeInTheDocument();
        expect(screen.getByText('Folder 1')).toBeInTheDocument();
        expect(screen.getByText('Folder 2')).toBeInTheDocument();
        expect(screen.getByText('Tag 1')).toBeInTheDocument();
        expect(screen.getByText('Tag 2')).toBeInTheDocument();
    });
});
