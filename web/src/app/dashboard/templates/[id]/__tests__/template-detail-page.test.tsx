import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TemplateDetailPage from '../page';

const mockGetTemplateDetail = jest.fn();
const mockGetTemplatePreview = jest.fn();
const mockUpdateTemplate = jest.fn();
const mockUpdateLibraryTemplate = jest.fn();
const mockCloneTemplate = jest.fn();
const mockPush = jest.fn();
let mockUser: { role: string; isSuperAdmin?: boolean } | null = { role: 'admin' };
let mockEditMode = true;

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'template-1' }),
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: (key: string) => (key === 'edit' && mockEditMode ? 'true' : null) }),
}));

jest.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    getTemplateDetail: (...args: any[]) => mockGetTemplateDetail(...args),
    getTemplatePreview: (...args: any[]) => mockGetTemplatePreview(...args),
    updateTemplate: (...args: any[]) => mockUpdateTemplate(...args),
    updateLibraryTemplate: (...args: any[]) => mockUpdateLibraryTemplate(...args),
    cloneTemplate: (...args: any[]) => mockCloneTemplate(...args),
  },
}));

jest.mock('@/components/TemplateEditor', () => function MockTemplateEditor() {
  return <div data-testid="template-editor" />;
});

jest.mock('@/components/LoadingSpinner', () => function MockLoadingSpinner() {
  return <div data-testid="loading-spinner" />;
});

const template = (isLibraryTemplate: boolean) => ({
  id: 'template-1',
  name: 'Restaurant Menu',
  description: 'Menu board template',
  category: 'restaurant',
  difficulty: 'beginner',
  orientation: 'landscape',
  templateHtml: '<div>Template</div>',
  sampleData: {},
  metadata: { isLibraryTemplate },
});

describe('TemplateDetailPage route selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { role: 'admin' };
    mockEditMode = true;
    mockGetTemplatePreview.mockResolvedValue({ html: '<div>Preview</div>' });
    mockUpdateTemplate.mockResolvedValue({});
    mockUpdateLibraryTemplate.mockResolvedValue({});
    mockCloneTemplate.mockResolvedValue({ id: 'content-1' });
  });

  it('saves global library template edits through the super-admin update route', async () => {
    mockUser = { role: 'admin', isSuperAdmin: true };
    mockGetTemplateDetail.mockResolvedValue(template(true));

    render(<TemplateDetailPage />);

    const save = await screen.findByRole('button', { name: /save changes/i });
    fireEvent.click(save);

    await waitFor(() => expect(mockUpdateLibraryTemplate).toHaveBeenCalledWith(
      'template-1',
      expect.objectContaining({ templateHtml: '<div>Template</div>' }),
    ));
    expect(mockUpdateTemplate).not.toHaveBeenCalled();
  });

  it('saves organization-owned template edits through the scoped save route', async () => {
    mockUser = { role: 'manager', isSuperAdmin: false };
    mockGetTemplateDetail.mockResolvedValue(template(false));

    render(<TemplateDetailPage />);

    const save = await screen.findByRole('button', { name: /save changes/i });
    fireEvent.click(save);

    await waitFor(() => expect(mockUpdateTemplate).toHaveBeenCalledWith(
      'template-1',
      expect.objectContaining({ templateHtml: '<div>Template</div>' }),
    ));
    expect(mockUpdateLibraryTemplate).not.toHaveBeenCalled();
  });

  it('does not show clone or edit actions to viewers', async () => {
    mockUser = { role: 'viewer', isSuperAdmin: false };
    mockEditMode = false;
    mockGetTemplateDetail.mockResolvedValue(template(true));

    render(<TemplateDetailPage />);

    expect(await screen.findByText('Restaurant Menu')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /edit visually/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clone to my content/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^clone template$/i })).not.toBeInTheDocument();
  });

  it('does not show clone actions for organization-owned templates', async () => {
    mockUser = { role: 'manager', isSuperAdmin: false };
    mockEditMode = false;
    mockGetTemplateDetail.mockResolvedValue(template(false));

    render(<TemplateDetailPage />);

    expect(await screen.findByText('Restaurant Menu')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /edit visually/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clone to my content/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^clone template$/i })).not.toBeInTheDocument();
  });
});
