import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DisplayPickerModal from '../DisplayPickerModal';

const mockGetDisplays = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    getDisplays: (...args: unknown[]) => mockGetDisplays(...args),
  },
}));

const displays = [
  { id: 'd-online', nickname: 'Lobby', status: 'online' },
  { id: 'd-offline', nickname: 'Back Office', status: 'offline' },
  { id: 'd-pairing', nickname: 'New Screen', status: 'pairing' },
  { id: 'd-error', nickname: 'Faulty Screen', status: 'error' },
  { id: 'd-weird', nickname: 'Mystery Screen', status: 'something-new' },
];

function rowFor(name: string): HTMLElement {
  const row = screen.getByText(name).closest('label');
  if (!row) throw new Error(`no row for ${name}`);
  return row as HTMLElement;
}

function statusTitleIn(row: HTMLElement): string | null {
  return row.querySelector('[title]')?.getAttribute('title') ?? null;
}

describe('DisplayPickerModal status dot', () => {
  beforeEach(() => {
    mockGetDisplays.mockResolvedValue({ data: displays });
  });

  it('gives each display its own status, not a binary Online/Offline', async () => {
    render(<DisplayPickerModal isOpen onClose={jest.fn()} onConfirm={jest.fn()} />);
    await screen.findByText('Lobby');

    expect(statusTitleIn(rowFor('Lobby'))).toBe('Online');
    expect(statusTitleIn(rowFor('Back Office'))).toBe('Offline');
    expect(statusTitleIn(rowFor('New Screen'))).toBe('Pairing');
    expect(statusTitleIn(rowFor('Faulty Screen'))).toBe('Error');
  });

  it('an unrecognised status reads Unknown, not Offline', async () => {
    render(<DisplayPickerModal isOpen onClose={jest.fn()} onConfirm={jest.fn()} />);
    await screen.findByText('Mystery Screen');

    expect(statusTitleIn(rowFor('Mystery Screen'))).toBe('Unknown');
  });
});
