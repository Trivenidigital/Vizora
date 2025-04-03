import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ContentManagement } from '../../pages/content/ContentManagement';
import { contentService } from '../../services/contentService';
import toast from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';

vi.mock('../../services/contentService');
vi.mock('react-hot-toast');

const mockContent = [
  {
    id: '1',
    name: 'Welcome Video',
    type: 'video',
    status: 'active',
    duration: 30,
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Company Logo',
    type: 'image',
    status: 'active',
    duration: null,
    createdAt: new Date().toISOString()
  },
  {
    id: '3',
    name: 'News Feed',
    type: 'web',
    status: 'inactive',
    duration: null,
    createdAt: new Date().toISOString()
  }
];

describe('Content Management Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (contentService.getContentList as jest.Mock).mockResolvedValue(mockContent);
  });

  it('loads and displays content list', async () => {
    render(
      <BrowserRouter>
        <ContentManagement />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Welcome Video')).toBeInTheDocument();
      expect(screen.getByText('Company Logo')).toBeInTheDocument();
      expect(screen.getByText('News Feed')).toBeInTheDocument();
    });
  });

  it('allows filtering content by type', async () => {
    render(
      <BrowserRouter>
        <ContentManagement />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Welcome Video')).toBeInTheDocument();
    });

    const filterSelect = screen.getByLabelText(/content type/i);
    fireEvent.change(filterSelect, { target: { value: 'video' } });

    await waitFor(() => {
      expect(screen.getByText('Welcome Video')).toBeInTheDocument();
      expect(screen.queryByText('Company Logo')).not.toBeInTheDocument();
      expect(screen.queryByText('News Feed')).not.toBeInTheDocument();
    });
  });

  it('allows searching content', async () => {
    render(
      <BrowserRouter>
        <ContentManagement />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Welcome Video')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search content/i);
    fireEvent.change(searchInput, { target: { value: 'logo' } });

    await waitFor(() => {
      expect(screen.queryByText('Welcome Video')).not.toBeInTheDocument();
      expect(screen.getByText('Company Logo')).toBeInTheDocument();
      expect(screen.queryByText('News Feed')).not.toBeInTheDocument();
    });
  });

  it('handles content deletion', async () => {
    (contentService.deleteContent as jest.Mock).mockResolvedValue(undefined);

    render(
      <BrowserRouter>
        <ContentManagement />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Welcome Video')).toBeInTheDocument();
    });

    const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0];
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(contentService.deleteContent).toHaveBeenCalledWith('1');
      expect(toast.success).toHaveBeenCalledWith('Content deleted successfully');
    });
  });

  it('handles content push to display', async () => {
    (contentService.pushContentToDisplay as jest.Mock).mockResolvedValue(undefined);

    render(
      <BrowserRouter>
        <ContentManagement />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Welcome Video')).toBeInTheDocument();
    });

    const pushButton = screen.getAllByRole('button', { name: /push to display/i })[0];
    fireEvent.click(pushButton);

    const displaySelect = screen.getByLabelText(/select display/i);
    fireEvent.change(displaySelect, { target: { value: 'display1' } });

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(contentService.pushContentToDisplay).toHaveBeenCalledWith('1', 'display1');
      expect(toast.success).toHaveBeenCalledWith('Content pushed to display successfully');
    });
  });

  it('handles errors gracefully', async () => {
    const error = new Error('Failed to load content');
    (contentService.getContentList as jest.Mock).mockRejectedValue(error);

    render(
      <BrowserRouter>
        <ContentManagement />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load content');
    });
  });
}); 