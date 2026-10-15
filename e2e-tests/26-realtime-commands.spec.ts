import { createRequire } from 'node:module';
import path from 'node:path';
import { test, expect, readData } from './fixtures/auth.fixture';
import { API, apiSend, seedDisplay } from './fixtures/seed';

/**
 * REALTIME COMMAND DELIVERY — dashboard API to a connected device socket
 *
 * Nothing else in the suite proves a command reaches a SCREEN: device status
 * specs read Postgres, and the browser never holds a device socket. Here a
 * device is paired through the real pairing API, connects to the realtime
 * gateway with the device JWT the pairing hands it, and a fleet command sent
 * as the dashboard user must arrive on that socket as `{ type, payload,
 * commandId }`.
 *
 * socket.io-client is a dependency of web/, not of the repo root, so it is
 * resolved from web/package.json rather than adding a root dependency.
 */
const requireFromWeb = createRequire(path.resolve(__dirname, '..', 'web', 'package.json'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { io } = requireFromWeb('socket.io-client') as typeof import('socket.io-client');

test.describe('Realtime command delivery', () => {
  test('a fleet command sent by the dashboard user reaches the paired device socket', async ({ authenticatedPage, token }) => {
    const page = authenticatedPage;
    const deviceIdentifier = `e2e-rt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // 1. The screen asks for a pairing code (public, device-side).
    const req = await page.request.post(`${API}/devices/pairing/request`, { data: { deviceIdentifier } });
    expect(req.ok(), `pairing request failed: ${req.status()} ${await req.text()}`).toBeTruthy();
    const { code } = await readData<{ code: string }>(req);
    expect(code).toBeTruthy();

    // 2. The operator enters it.
    const nickname = `Realtime Screen ${Date.now()}`;
    const complete = await apiSend(page, token, 'POST', '/devices/pairing/complete', { code, nickname });
    expect(complete.ok(), `pairing complete failed: ${complete.status()} ${await complete.text()}`).toBeTruthy();

    // 3. The screen polls and receives its credential.
    const status = await page.request.get(`${API}/devices/pairing/status/${code}`);
    expect(status.ok(), `pairing status failed: ${status.status()}`).toBeTruthy();
    const paired = await readData<{ status: string; deviceToken: string; deviceId: string }>(status);
    expect(paired.status).toBe('paired');
    expect(paired.deviceToken).toBeTruthy();

    // 4. The screen connects to the realtime gateway as itself.
    const socket = io('http://localhost:3002', {
      auth: { token: paired.deviceToken, capabilities: ['deliveryAck'] },
      transports: ['websocket'],
      reconnection: false,
    });
    const received: Array<{ type: string; payload?: unknown; commandId?: string }> = [];
    socket.on('command', (cmd: any, ack?: (a: { ok: boolean }) => void) => {
      received.push(cmd);
      ack?.({ ok: true });
    });
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve());
        socket.once('connect_error', (e: Error) => reject(new Error(`device socket refused: ${e.message}`)));
        setTimeout(() => reject(new Error('device socket did not connect in 10s')), 10000);
      });

      // The gateway marks the device online once it has joined its rooms.
      await expect
        .poll(async () => {
          const res = await page.request.get(`${API}/displays/${paired.deviceId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          return (await readData<{ status: string }>(res)).status;
        }, { timeout: 15000 })
        .toBe('online');

      // CONTROL: a command addressed to ANOTHER display must not arrive here,
      // so an arrival below is routing, not a socket that hears everything.
      const other = await seedDisplay(page, token);
      const stray = await apiSend(page, token, 'POST', '/fleet/commands', {
        command: 'clear_cache',
        target: { type: 'device', id: other.id },
      });
      expect(stray.ok(), `control command failed: ${stray.status()} ${await stray.text()}`).toBeTruthy();
      await page.waitForTimeout(2000);
      expect(received).toEqual([]);

      // 5. The operator sends a command to that device.
      const sent = await apiSend(page, token, 'POST', '/fleet/commands', {
        command: 'reload',
        target: { type: 'device', id: paired.deviceId },
      });
      expect(sent.ok(), `fleet command failed: ${sent.status()} ${await sent.text()}`).toBeTruthy();
      const result = await readData<{ commandId: string; devicesTargeted: number; devicesDelivered: number }>(sent);
      expect(result.devicesTargeted).toBe(1);

      // 6. It arrives on the device socket, typed, carrying the same id.
      await expect.poll(() => received.length, { timeout: 15000 }).toBeGreaterThan(0);
      expect(received[0].type).toBe('reload');
      expect(received[0].commandId).toBe(result.commandId);
      expect(result.devicesDelivered).toBe(1);
    } finally {
      socket.close();
    }
  });
});
