import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { IsString, ValidateNested } from 'class-validator';
import { VALIDATION_PIPE_OPTIONS } from '../config/validation-pipe.options';
import {
  BroadcastCommandDto,
  BroadcastNotificationDto,
  DeviceCommandDto,
  DeviceRevokedDto,
  InternalCommandDto,
  PushContentDto,
  PushPlaylistDto,
  TenantEntitlementDto,
} from './internal-api.dto';

/**
 * Contract between middleware and the realtime internal HTTP API, run through
 * the gateway's REAL global pipe (main.ts options). Each body below is built
 * exactly as the named middleware call site builds it, then JSON round-tripped
 * as it is on the wire (so an `undefined` payload disappears, as it does in
 * axios).
 *
 * Why this exists: until the realtime bundle stopped inlining class-transformer,
 * the pipe never saw @Type on `command`, so whitelist stripped the nested
 * command and devices received no `type`. ts-jest does not bundle, so this
 * suite cannot catch a re-bundled copy (scripts/ops/assert-bundle-externals.ts
 * does) — it pins that the DTOs, once their metadata IS honoured, accept every
 * shape middleware actually sends and keep the fields the gateway reads.
 */
const pipe = new ValidationPipe(VALIDATION_PIPE_OPTIONS);

const wire = <T>(body: T): T => JSON.parse(JSON.stringify(body));

const run = <T>(metatype: new () => T, body: unknown): Promise<T> =>
  pipe.transform(wire(body), { type: 'body', metatype, data: '' });

describe('realtime internal API — middleware payloads through the real ValidationPipe', () => {
  describe('POST /api/internal/command (InternalCommandDto)', () => {
    it('keeps type + payload.requestId for the screenshot request (displays.service requestScreenshot)', async () => {
      const out = await run(InternalCommandDto, {
        deviceId: 'display-1',
        command: { type: 'screenshot', payload: { requestId: '6f1c5b8e-0f4e-4a43-9a65-1b1a9f1d2c33' } },
      });

      expect(out.command).toBeInstanceOf(DeviceCommandDto);
      expect(out.command.type).toBe('screenshot');
      expect(out.command.payload).toEqual({ requestId: '6f1c5b8e-0f4e-4a43-9a65-1b1a9f1d2c33' });
      expect(out.deviceId).toBe('display-1');
    });

    it('keeps type for enable, whose payload is undefined and so absent on the wire (displays.service sendDeviceCommand)', async () => {
      const out = await run(InternalCommandDto, {
        deviceId: 'display-1',
        command: { type: 'enable', payload: undefined },
      });

      expect(out.command.type).toBe('enable');
      expect(out.command.payload).toBeUndefined();
    });

    it("keeps type 'disable' — the value app.controller branches on", async () => {
      const out = await run(InternalCommandDto, {
        deviceId: 'display-1',
        command: { type: 'disable' },
      });

      expect(out.command.type).toBe('disable');
    });

    it('strips an undeclared key from the nested command but keeps the declared ones', async () => {
      const out = await run(InternalCommandDto, {
        deviceId: 'display-1',
        command: { type: 'reload', injected: 'x' },
      });

      expect(out.command).toEqual(Object.assign(new DeviceCommandDto(), { type: 'reload' }));
    });

    it('rejects an unknown command type — the nested DTO is genuinely validated', async () => {
      await expect(
        run(InternalCommandDto, { deviceId: 'display-1', command: { type: 'self_destruct' } }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a command with no type', async () => {
      await expect(
        run(InternalCommandDto, { deviceId: 'display-1', command: {} }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('POST /api/commands/broadcast (BroadcastCommandDto) — fleet.service callGatewayBroadcast', () => {
    // Every command SendCommandDto admits, with the payload fleet forwards
    // (`commandData.payload || {}`) and its commandId.
    const cases: Array<[string, Record<string, unknown>]> = [
      ['reload', {}],
      ['restart', {}],
      ['reboot', {}],
      ['clear_cache', {}],
      ['push_content', { contentId: 'content-1', duration: 60, priority: 'emergency' }],
      ['update', { feedUrl: 'https://updates.vizora.cloud/display' }],
    ];

    it.each(cases)('keeps type, commandId and payload for %s', async (type, payload) => {
      const commandId = '0b6f0e8a-4d0e-4b5c-8a1f-2f9f6a3e7d10';
      const out = await run(BroadcastCommandDto, {
        deviceIds: ['display-1', 'display-2'],
        command: { type, payload, commandId },
      });

      expect(out.command).toBeInstanceOf(DeviceCommandDto);
      expect(out.command.type).toBe(type);
      expect(out.command.commandId).toBe(commandId);
      expect(out.command.payload).toEqual(payload);
      expect(out.deviceIds).toEqual(['display-1', 'display-2']);
    });
  });

  describe('the other internal routes', () => {
    it('push/playlist keeps the whole playlist object (displays.service + playlists.service)', async () => {
      const playlist = {
        id: 'pl-1',
        name: 'Lobby',
        updatedAt: '2026-10-15T10:00:00.000Z',
        items: [{ id: 'it-1', order: 0, duration: 10, content: { id: 'c-1', type: 'image', url: 'https://x/y.png' } }],
      };
      const out = await run(PushPlaylistDto, { deviceId: 'display-1', playlist });

      expect(out.playlist).toEqual(playlist);
    });

    it('push/content keeps content + duration (displays.service pushContent)', async () => {
      const content = {
        id: 'c-1',
        name: 'Promo',
        type: 'image',
        url: 'https://x/y.png',
        thumbnailUrl: null,
        mimeType: 'image/png',
        duration: 10,
      };
      const out = await run(PushContentDto, { deviceId: 'display-1', content, duration: 30 });

      expect(out.content).toEqual(content);
      expect(out.duration).toBe(30);
    });

    it('notifications/broadcast keeps the notification (notifications.service)', async () => {
      const notification = { id: 'n-1', title: 'Display offline', severity: 'warning', type: 'device_offline' };
      const out = await run(BroadcastNotificationDto, { organizationId: 'org-1', notification });

      expect(out.notification).toEqual(notification);
    });

    it('internal/device-revoked keeps the reason (displays.service sendDeviceRevoked)', async () => {
      const out = await run(DeviceRevokedDto, { deviceId: 'display-1', reason: 'unpaired' });

      expect(out).toEqual(Object.assign(new DeviceRevokedDto(), { deviceId: 'display-1', reason: 'unpaired' }));
    });

    it.each(['suspended', 'resumed'] as const)(
      'internal/tenant-entitlement accepts %s with and without a reason (tenant-entitlement.notifier)',
      async (state) => {
        await expect(run(TenantEntitlementDto, { organizationId: 'org-1', state, reason: 'grace_expired' })).resolves.toMatchObject({ state });
        await expect(run(TenantEntitlementDto, { organizationId: 'org-1', state, reason: undefined })).resolves.toMatchObject({ state });
      },
    );
  });

  // The control that MUST fail: the same body through a structurally identical
  // DTO whose nested class is not declared via @Type — exactly what the pipe saw
  // while the bundle split class-transformer's metadata store. Whitelist strips
  // the nested command to `{}`: the device receives a command with no `type`.
  it('control: without @Type metadata whitelist strips the nested command to {} — no type reaches the device', async () => {
    class UntypedInternalCommandDto {
      @IsString()
      deviceId!: string;

      @ValidateNested()
      command!: DeviceCommandDto;
    }

    const out = await run(UntypedInternalCommandDto, {
      deviceId: 'display-1',
      command: { type: 'disable' },
    });

    expect(out.command).toEqual({});
    expect(out.command.type).toBeUndefined();
  });
});
