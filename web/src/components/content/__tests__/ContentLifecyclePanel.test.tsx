import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ContentLifecyclePanel from '../ContentLifecyclePanel';
import type { Content } from '@/lib/types';

const mockGetContentVersions = jest.fn();
const mockSetContentExpiration = jest.fn();
const mockClearContentExpiration = jest.fn();
const mockReplaceContentFile = jest.fn();
const mockRestoreContentVersion = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    getContentVersions: (...args: any[]) => mockGetContentVersions(...args),
    setContentExpiration: (...args: any[]) => mockSetContentExpiration(...args),
    clearContentExpiration: (...args: any[]) => mockClearContentExpiration(...args),
    replaceContentFile: (...args: any[]) => mockReplaceContentFile(...args),
    restoreContentVersion: (...args: any[]) => mockRestoreContentVersion(...args),
  },
}));

const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() };
jest.mock('@/lib/hooks/useToast', () => ({ useToast: () => mockToast }));

function makeContent(overrides: Partial<Content> = {}): Content {
  return {
    id: 'c1',
    title: 'Lobby Banner',
    type: 'image',
    status: 'active',
    duration: 10,
    versionNumber: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ContentLifecyclePanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetContentVersions.mockResolvedValue([makeContent()]);
  });

  it('loads version history on mount', async () => {
    render(
      <ContentLifecyclePanel content={makeContent()} replacementCandidates={[]} onChanged={jest.fn()} />,
    );
    await waitFor(() => expect(mockGetContentVersions).toHaveBeenCalledWith('c1'));
  });

  it('schedules an expiration with a chosen replacement and fires onChanged', async () => {
    const onChanged = jest.fn();
    mockSetContentExpiration.mockResolvedValue(makeContent());
    const candidate = makeContent({ id: 'c2', title: 'Backup Banner' });

    render(
      <ContentLifecyclePanel
        content={makeContent()}
        replacementCandidates={[candidate]}
        onChanged={onChanged}
      />,
    );
    await waitFor(() => expect(mockGetContentVersions).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Expires at'), { target: { value: '2099-06-15T10:30' } });
    fireEvent.change(screen.getByLabelText('Replace with (optional)'), { target: { value: 'c2' } });
    fireEvent.click(screen.getByRole('button', { name: /schedule expiration/i }));

    await waitFor(() => expect(mockSetContentExpiration).toHaveBeenCalled());
    const [id, iso, replacementId] = mockSetContentExpiration.mock.calls[0];
    expect(id).toBe('c1');
    expect(typeof iso).toBe('string');
    expect(replacementId).toBe('c2');
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('clears an existing expiration', async () => {
    const onChanged = jest.fn();
    mockClearContentExpiration.mockResolvedValue(makeContent());

    render(
      <ContentLifecyclePanel
        content={makeContent({ expiresAt: '2099-01-01T00:00:00.000Z' })}
        replacementCandidates={[]}
        onChanged={onChanged}
      />,
    );
    await waitFor(() => expect(mockGetContentVersions).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /clear expiration/i }));

    await waitFor(() => expect(mockClearContentExpiration).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('replaces the file and reloads versions', async () => {
    const onChanged = jest.fn();
    mockReplaceContentFile.mockResolvedValue({ content: makeContent(), fileHash: 'h' });

    render(
      <ContentLifecyclePanel content={makeContent()} replacementCandidates={[]} onChanged={onChanged} />,
    );
    await waitFor(() => expect(mockGetContentVersions).toHaveBeenCalledTimes(1));

    const file = new File(['x'], 'new.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /replace file/i }));

    await waitFor(() =>
      expect(mockReplaceContentFile).toHaveBeenCalledWith('c1', file, { keepBackup: true }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    // versions reloaded after replace
    await waitFor(() => expect(mockGetContentVersions).toHaveBeenCalledTimes(2));
  });

  it('restores a previous version', async () => {
    const onChanged = jest.fn();
    mockGetContentVersions.mockResolvedValue([
      makeContent({ id: 'c1', versionNumber: 2 }),
      makeContent({ id: 'c1-v1', versionNumber: 1, status: 'archived', title: 'Lobby Banner (v1)' }),
    ]);
    mockRestoreContentVersion.mockResolvedValue(makeContent());

    render(
      <ContentLifecyclePanel content={makeContent({ versionNumber: 2 })} replacementCandidates={[]} onChanged={onChanged} />,
    );
    await waitFor(() => expect(screen.getByRole('button', { name: /restore/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /restore/i }));

    await waitFor(() => expect(mockRestoreContentVersion).toHaveBeenCalledWith('c1-v1'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});
