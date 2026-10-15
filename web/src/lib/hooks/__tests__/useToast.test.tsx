import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { ToastProvider, useToast } from '../useToast';
import ActiveOverrideBanner from '@/components/fleet/ActiveOverrideBanner';

jest.mock('@/theme/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

const mockGetActiveOverrides = jest.fn();
const mockClearOverride = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    getActiveOverrides: (...args: unknown[]) => mockGetActiveOverrides(...args),
    clearOverride: (...args: unknown[]) => mockClearOverride(...args),
  },
}));

/** Raises a toast and never renders `ToastContainer` — the shape of the 9 silent callers. */
function NoContainerCaller() {
  const toast = useToast();
  return <button onClick={() => toast.success('Schedule created')}>save</button>;
}

/** Raises a toast AND renders `ToastContainer` — the shape of every other caller. */
function ContainerCaller() {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast.error('Save failed')}>save</button>
      <toast.ToastContainer />
    </>
  );
}

describe('useToast / ToastProvider', () => {
  it('shows a toast from a caller that never renders ToastContainer', () => {
    render(
      <ToastProvider>
        <NoContainerCaller />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('save'));

    expect(screen.getByRole('alert')).toHaveTextContent('Schedule created');
  });

  it('renders exactly one toast when the caller also renders ToastContainer', () => {
    render(
      <ToastProvider>
        <ContainerCaller />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('save'));

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Save failed');
  });

  it("shows a child component's toast — a parent's container used to be unable to", () => {
    render(
      <ToastProvider>
        <ContainerCaller />
        <NoContainerCaller />
      </ToastProvider>
    );

    fireEvent.click(screen.getAllByText('save')[1]);

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Schedule created');
  });

  it('auto-dismisses after the default 5s', () => {
    jest.useFakeTimers();
    try {
      render(
        <ToastProvider>
          <NoContainerCaller />
        </ToastProvider>
      );
      fireEvent.click(screen.getByText('save'));
      expect(screen.getByRole('alert')).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(5300);
      });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('returns a referentially stable object, so callers listing it in deps do not re-run every render', () => {
    const { result, rerender } = renderHook(() => useToast(), { wrapper: ToastProvider });
    const first = result.current;

    rerender();
    act(() => {
      first.info('changes provider state');
    });

    expect(result.current).toBe(first);
    expect(result.current.success).toBe(first.success);
    expect(result.current.ToastContainer).toBe(first.ToastContainer);
  });

  it('throws outside a provider instead of silently dropping toasts', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => renderHook(() => useToast())).toThrow('useToast must be used within ToastProvider');
    } finally {
      spy.mockRestore();
    }
  });

  it('a real formerly-silent caller (ActiveOverrideBanner) now surfaces its success toast', async () => {
    mockGetActiveOverrides.mockResolvedValue([
      {
        commandId: 'cmd-1',
        contentId: 'content-1',
        contentTitle: 'Emergency Announcement',
        targetType: 'organization',
        targetId: 'org-1',
        targetName: 'All Devices',
        duration: 60,
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        startedBy: 'admin@test.com',
      },
    ]);
    mockClearOverride.mockResolvedValue({ devicesNotified: 3 });

    render(
      <ToastProvider>
        <ActiveOverrideBanner />
      </ToastProvider>
    );

    fireEvent.click(await screen.findByText('Clear Override'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Override cleared, 3 devices notified');
    });
  });
});

describe('toast stack structural guards', () => {
  const srcRoot = join(process.cwd(), 'src');

  it('the root layout mounts ToastProvider around every route', () => {
    const layout = readFileSync(join(srcRoot, 'app/layout.tsx'), 'utf8');
    const open = layout.indexOf('<ToastProvider>');
    const close = layout.indexOf('</ToastProvider>');

    expect(open).toBeGreaterThanOrEqual(0);
    expect(close).toBeGreaterThan(open);
    expect(layout.slice(open, close)).toContain('{children}');
  });

  it('only the provider renders <Toast> — no file builds a private stack again', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          if (name !== '__tests__') walk(path);
        } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
          const source = readFileSync(path, 'utf8');
          if (/from ['"](@\/components|\.{1,2})\/Toast['"]/.test(source)) {
            offenders.push(relative(srcRoot, path).replace(/\\/g, '/'));
          }
        }
      }
    };
    walk(srcRoot);

    expect(offenders).toEqual(['lib/hooks/useToast.tsx']);
  });
});
