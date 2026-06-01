import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EditPageClient from '../page-client';

const mockGetTemplateDetail = jest.fn();
const mockGetTemplatePreview = jest.fn();
const mockUpdateTemplate = jest.fn();
const mockUpdateLibraryTemplate = jest.fn();
const mockSerialize = jest.fn();
const mockPush = jest.fn();
const mockToastError = jest.fn();
const mockToastSuccess = jest.fn();
let mockUser: { role: string; isSuperAdmin?: boolean } | null = { role: 'admin' };

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

jest.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));

jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => ({
    error: mockToastError,
    success: mockToastSuccess,
  }),
}));

jest.mock('@/lib/api', () => ({
  apiClient: {
    getTemplateDetail: (...args: any[]) => mockGetTemplateDetail(...args),
    getTemplatePreview: (...args: any[]) => mockGetTemplatePreview(...args),
    updateTemplate: (...args: any[]) => mockUpdateTemplate(...args),
    updateLibraryTemplate: (...args: any[]) => mockUpdateLibraryTemplate(...args),
  },
}));

jest.mock('@/components/template-editor/TemplateEditorCanvas', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return React.forwardRef(function MockTemplateEditorCanvas(props: any, ref: any) {
    React.useImperativeHandle(ref, () => ({
      serialize: mockSerialize,
      sendUpdate: jest.fn(),
    }));
    React.useEffect(() => {
      props.onReady?.();
    }, [props]);
    return <div data-testid="template-editor-canvas" />;
  });
});

jest.mock('@/components/template-editor/PropertyPanel', () => function MockPropertyPanel() {
  return <div data-testid="property-panel" />;
});

jest.mock('@/components/template-editor/DisplayPickerModal', () => function MockDisplayPickerModal() {
  return <div data-testid="display-picker" />;
});

jest.mock('@/components/template-editor/FloatingToolbar', () => function MockFloatingToolbar() {
  return <div data-testid="floating-toolbar" />;
});

jest.mock('@/components/template-editor/useEditorHistory', () => ({
  useEditorHistory: () => ({
    pushChange: jest.fn(),
    canUndo: false,
    canRedo: false,
    undo: jest.fn(),
    redo: jest.fn(),
  }),
}));

jest.mock('@/components/template-editor/useCanvasZoom', () => ({
  useCanvasZoom: () => ({
    containerRef: { current: null },
    zoomPreset: 'fit',
    setZoomPreset: jest.fn(),
    scale: 1,
    isScrollable: false,
  }),
}));

const template = (isLibraryTemplate: boolean) => ({
  id: 'template-1',
  name: 'Restaurant Menu',
  metadata: { isLibraryTemplate },
});

describe('EditPageClient route selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { role: 'admin' };
    mockGetTemplatePreview.mockResolvedValue({ html: '<div>Preview</div>' });
    mockUpdateTemplate.mockResolvedValue({});
    mockUpdateLibraryTemplate.mockResolvedValue({});
    mockSerialize.mockResolvedValue('<div>Edited</div>');
  });

  it('saves global library template drafts through the super-admin update route', async () => {
    mockUser = { role: 'admin', isSuperAdmin: true };
    mockGetTemplateDetail.mockResolvedValue(template(true));

    render(<EditPageClient templateId="template-1" />);

    const save = await screen.findByRole('button', { name: /save as draft/i });
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);

    await waitFor(() => expect(mockUpdateLibraryTemplate).toHaveBeenCalledWith('template-1', {
      templateHtml: '<div>Edited</div>',
    }));
    expect(mockUpdateTemplate).not.toHaveBeenCalled();
  });

  it('saves organization-owned template drafts through the scoped save route', async () => {
    mockUser = { role: 'manager', isSuperAdmin: false };
    mockGetTemplateDetail.mockResolvedValue(template(false));

    render(<EditPageClient templateId="template-1" />);

    const save = await screen.findByRole('button', { name: /save as draft/i });
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);

    await waitFor(() => expect(mockUpdateTemplate).toHaveBeenCalledWith('template-1', {
      templateHtml: '<div>Edited</div>',
    }));
    expect(mockUpdateLibraryTemplate).not.toHaveBeenCalled();
  });

  it('keeps viewers out of the visual editor even for organization-owned templates', async () => {
    mockUser = { role: 'viewer', isSuperAdmin: false };
    mockGetTemplateDetail.mockResolvedValue(template(false));

    render(<EditPageClient templateId="template-1" />);

    expect(await screen.findByText(/template editing is not available/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save as draft/i })).not.toBeInTheDocument();
  });
});
