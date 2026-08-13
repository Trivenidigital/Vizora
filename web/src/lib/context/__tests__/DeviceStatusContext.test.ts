import { mergeStatus, DeviceStatusUpdate } from '../DeviceStatusContext';

/**
 * Regression tests for device identity surviving live status updates.
 *
 * The dashboard rendered "Unnamed Device — No location" for every device, with
 * a fabricated "just now" timestamp, because the socket handler replaced the
 * stored entry with a payload that carries liveness but no metadata.
 */

const initial: DeviceStatusUpdate = {
  deviceId: 'dev-1',
  status: 'online',
  timestamp: 1_000,
  metadata: {
    nickname: 'Flagship — Window Wall',
    location: 'Seattle · 1st & Pike',
    lastSeen: '2026-08-13T10:00:00.000Z',
  },
};

/** What the realtime gateway actually sends: liveness only. */
const socketUpdate: DeviceStatusUpdate = {
  deviceId: 'dev-1',
  status: 'offline',
  timestamp: 2_000,
};

describe('mergeStatus', () => {
  it('keeps the device identity when a status-only update arrives', () => {
    const merged = mergeStatus(initial, socketUpdate);

    expect(merged.metadata?.nickname).toBe('Flagship — Window Wall');
    expect(merged.metadata?.location).toBe('Seattle · 1st & Pike');
    expect(merged.metadata?.lastSeen).toBe('2026-08-13T10:00:00.000Z');
  });

  it('still applies the new liveness — identity is preserved, status is not stale', () => {
    const merged = mergeStatus(initial, socketUpdate);

    expect(merged.status).toBe('offline');
    expect(merged.timestamp).toBe(2_000);
  });

  it('lets the server override individual metadata fields it does send', () => {
    const merged = mergeStatus(initial, {
      ...socketUpdate,
      metadata: { lastSeen: '2026-08-13T12:00:00.000Z' },
    });

    expect(merged.metadata?.lastSeen).toBe('2026-08-13T12:00:00.000Z');
    // …without dropping the fields it did not send.
    expect(merged.metadata?.nickname).toBe('Flagship — Window Wall');
  });

  it('returns the update unchanged for a device we have never seen', () => {
    expect(mergeStatus(undefined, socketUpdate)).toEqual(socketUpdate);
  });

  it('does not invent an empty metadata object when neither side has one', () => {
    const bare: DeviceStatusUpdate = { deviceId: 'dev-2', status: 'online', timestamp: 1 };
    expect(mergeStatus(bare, { ...bare, timestamp: 2 }).metadata).toBeUndefined();
  });
});
