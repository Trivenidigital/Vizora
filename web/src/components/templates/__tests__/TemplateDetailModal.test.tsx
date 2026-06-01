import { render, screen } from '@testing-library/react';
import TemplateDetailModal from '../TemplateDetailModal';

const mockGetTemplateDetail = jest.fn();
const mockGetTemplatePreview = jest.fn();
const mockSearchTemplates = jest.fn();
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    getTemplateDetail: (...args: any[]) => mockGetTemplateDetail(...args),
    getTemplatePreview: (...args: any[]) => mockGetTemplatePreview(...args),
    searchTemplates: (...args: any[]) => mockSearchTemplates(...args),
  },
}));

describe('TemplateDetailModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTemplateDetail.mockResolvedValue({
      id: 'template-1',
      name: 'Restaurant Menu',
      description: 'Menu board template',
      category: 'restaurant',
      difficulty: 'beginner',
      templateOrientation: 'landscape',
      libraryTags: ['menu'],
      isFeatured: false,
      useCount: 0,
      createdAt: '2026-01-01T00:00:00Z',
      metadata: { isLibraryTemplate: true },
    });
    mockGetTemplatePreview.mockResolvedValue({ html: '<div>Preview</div>' });
    mockSearchTemplates.mockResolvedValue({ data: [] });
  });

  it('keeps customer users on clone/use actions instead of platform edit routes', async () => {
    render(
      <TemplateDetailModal
        templateId="template-1"
        onClose={jest.fn()}
        onUseTemplate={jest.fn()}
        onCustomize={jest.fn()}
        canUseTemplates
      />,
    );

    expect(await screen.findByText('Restaurant Menu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /use this template/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit visually/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /customize/i })).not.toBeInTheDocument();
  });

  it('keeps visual editing available for organization-owned template clones', async () => {
    mockGetTemplateDetail.mockResolvedValueOnce({
      id: 'template-1',
      name: 'Restaurant Menu',
      description: 'Menu board template',
      category: 'restaurant',
      difficulty: 'beginner',
      templateOrientation: 'landscape',
      libraryTags: ['menu'],
      isFeatured: false,
      useCount: 0,
      createdAt: '2026-01-01T00:00:00Z',
      metadata: { isLibraryTemplate: false },
    });

    render(
      <TemplateDetailModal
        templateId="template-1"
        onClose={jest.fn()}
        onUseTemplate={jest.fn()}
        onCustomize={jest.fn()}
        canEditOrgTemplates
        canUseTemplates
      />,
    );

    expect(await screen.findByText('Restaurant Menu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit visually/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /customize/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /use this template/i })).not.toBeInTheDocument();
  });

  it('keeps viewers on read-only org-owned template details', async () => {
    mockGetTemplateDetail.mockResolvedValueOnce({
      id: 'template-1',
      name: 'Restaurant Menu',
      description: 'Menu board template',
      category: 'restaurant',
      difficulty: 'beginner',
      templateOrientation: 'landscape',
      libraryTags: ['menu'],
      isFeatured: false,
      useCount: 0,
      createdAt: '2026-01-01T00:00:00Z',
      metadata: { isLibraryTemplate: false },
    });

    render(
      <TemplateDetailModal
        templateId="template-1"
        onClose={jest.fn()}
        onUseTemplate={jest.fn()}
        onCustomize={jest.fn()}
      />,
    );

    expect(await screen.findByText('Restaurant Menu')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /use this template/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit visually/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /customize/i })).not.toBeInTheDocument();
  });
});
