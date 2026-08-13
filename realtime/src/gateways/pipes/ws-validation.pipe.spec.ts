import { ArgumentMetadata } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { WsValidationPipe } from './ws-validation.pipe';
import { HeartbeatMessageDto, ContentImpressionDto } from '../dto';

class TestDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsString()
  optional?: string;
}

describe('WsValidationPipe', () => {
  let pipe: WsValidationPipe;

  beforeEach(() => {
    pipe = new WsValidationPipe();
  });

  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: TestDto,
  };

  describe('valid DTOs', () => {
    it('should pass validation for a valid DTO', async () => {
      const value = { name: 'test', value: 42 };
      const result = await pipe.transform(value, metadata);
      expect(result).toBeDefined();
      expect(result.name).toBe('test');
      expect(result.value).toBe(42);
    });

    it('should pass validation with optional fields present', async () => {
      const value = { name: 'test', value: 10, optional: 'extra' };
      const result = await pipe.transform(value, metadata);
      expect(result).toBeDefined();
      expect(result.optional).toBe('extra');
    });

    it('should pass validation with optional fields absent', async () => {
      const value = { name: 'test', value: 0 };
      const result = await pipe.transform(value, metadata);
      expect(result).toBeDefined();
      expect(result.optional).toBeUndefined();
    });
  });

  describe('invalid DTOs', () => {
    it('should throw WsException for missing required fields', async () => {
      const value = { name: 'test' }; // missing 'value'
      await expect(pipe.transform(value, metadata)).rejects.toThrow(WsException);
    });

    it('should throw WsException for wrong types', async () => {
      const value = { name: 123, value: 'not a number' };
      await expect(pipe.transform(value, metadata)).rejects.toThrow(WsException);
    });

    it('should throw WsException for constraint violations', async () => {
      const value = { name: 'test', value: -1 }; // Min(0) violation
      await expect(pipe.transform(value, metadata)).rejects.toThrow(WsException);
    });

    it('should throw WsException with validation details', async () => {
      const value = { name: 'test' };
      try {
        await pipe.transform(value, metadata);
        fail('Should have thrown WsException');
      } catch (e) {
        expect(e).toBeInstanceOf(WsException);
        const error = (e as WsException).getError();
        expect(error).toHaveProperty('error', 'Validation failed');
        expect(error).toHaveProperty('details');
      }
    });
  });

  describe('edge cases', () => {
    it('should pass through primitives without metatype', async () => {
      const primitiveMetadata: ArgumentMetadata = { type: 'body', metatype: String };
      const result = await pipe.transform('hello', primitiveMetadata);
      expect(result).toBe('hello');
    });

    it('should pass through when no metatype provided', async () => {
      const noMeta: ArgumentMetadata = { type: 'body' };
      const result = await pipe.transform({ anything: true }, noMeta);
      expect(result).toEqual({ anything: true });
    });

    it('should handle empty object for DTO with required fields', async () => {
      const value = {};
      await expect(pipe.transform(value, metadata)).rejects.toThrow(WsException);
    });

    it('should reject unknown properties (forbidNonWhitelisted)', async () => {
      const value = { name: 'test', value: 1, unknown: 'field' };
      await expect(pipe.transform(value, metadata)).rejects.toThrow(WsException);
    });
  });

  describe('Contract v1.1 enriched heartbeat (B2 cross-repo compat gate)', () => {
    const hbMeta: ArgumentMetadata = { type: 'body', metatype: HeartbeatMessageDto };

    it('ACCEPTS an enriched heartbeat with screenState + playbackSource', async () => {
      // The shipped Android TV app sends these top-level fields. Before widening
      // the DTO, forbidNonWhitelisted rejected the whole heartbeat → the device
      // looked offline. This asserts the enriched payload now validates.
      const enriched = {
        uptime: 3600,
        appVersion: '1.0.1',
        metrics: { cpuUsage: 10, memoryUsage: 40 },
        currentContent: { contentId: 'c1' },
        screenState: 'playing',
        playbackSource: 'live',
      };
      const result = await pipe.transform(enriched, hbMeta);
      expect(result.screenState).toBe('playing');
      expect(result.playbackSource).toBe('live');
    });

    it('accepts a legacy heartbeat without the new fields (backward compatible)', async () => {
      const legacy = { uptime: 10, appVersion: '1.0.0', metrics: { cpuUsage: 1 } };
      const result = await pipe.transform(legacy, hbMeta);
      expect(result.screenState).toBeUndefined();
      expect(result.playbackSource).toBeUndefined();
    });

    it('still rejects a genuinely unknown field (whitelist stays tight)', async () => {
      const bogus = { uptime: 10, notAContractField: 'x' };
      await expect(pipe.transform(bogus, hbMeta)).rejects.toThrow(WsException);
    });

    it('ACCEPTS the REAL shipped heartbeat payload, contentVersion included', async () => {
      // Regression for a live production outage. This block existed and still
      // missed it: `contentVersion` shipped in the player at v1.3.10 and was
      // never added here, so forbidNonWhitelisted rejected EVERY heartbeat from
      // v1.3.10 through v1.3.13. The status refresh and appVersion persistence
      // never ran and the ack never returned. The four-release span comes from the
      // code (b08e3ae, tagged v1.3.10–v1.3.13); production corroborates it more
      // narrowly — no device carries metadata.appVersion, though that writer only
      // landed 2026-08-11, so the DB covers ~2 days rather than the whole window.
      //
      // Copied from vizora-tv src/main.ts heartbeatData as of v1.3.13.
      //
      // Being explicit about what this does NOT give us: it is a hand-maintained
      // literal in a different repo from the player, so nothing makes it track
      // changes there. A future player-side field will still pass CI here. The
      // block this sits in is titled "cross-repo compat gate" and its fixture was
      // written the same way — it omitted contentVersion and shipped this outage,
      // and it also never caught the content:impression timestamp mismatch.
      //
      // The real protection is the tolerant pipe for telemetry (an unknown field
      // is now stripped, not fatal). This fixture is a regression check, not a
      // gate. Closing the gap properly needs the fixture exported from the player
      // itself, or a vizora-tv CI job validating its real payloads against these
      // DTOs — tracked separately.
      const shipped = {
        uptime: 3600,
        appVersion: '1.3.13',
        contentVersion: '2026-08-13T05:00:00.000Z', // real format: monotonic ISO, not a concatenated signature
        metrics: { cpuUsage: 0, memoryUsage: 42.5 },
        currentContent: { contentId: 'c1' },
        screenState: 'playing',
        playbackSource: 'live',
      };
      const result = await pipe.transform(shipped, hbMeta);
      expect(result.contentVersion).toBe('2026-08-13T05:00:00.000Z');
      expect(result.appVersion).toBe('1.3.13');
    });

    it('ACCEPTS the empty-string contentVersion a freshly booted device sends', async () => {
      // The player initialises currentContentVersion to '' and sends it before it
      // has rendered anything, so the empty string is the FIRST value the server
      // ever sees. @IsOptional() alone would not have saved us here — '' is
      // present, not absent — which is precisely why the field had to be
      // whitelisted rather than merely tolerated.
      const booting = { uptime: 2, appVersion: '1.3.13', contentVersion: '' };
      const result = await pipe.transform(booting, hbMeta);
      expect(result.contentVersion).toBe('');
    });

    it('accepts an ISO-8601 version — the format the resolver actually emits', async () => {
      // 24 chars. The cap is a contract on the generator, so pin the real shape
      // rather than only the boundary: a version must be monotonic and short.
      const iso = { uptime: 10, contentVersion: '2026-08-13T05:00:00.000Z' };
      expect((await pipe.transform(iso, hbMeta)).contentVersion).toBe('2026-08-13T05:00:00.000Z');
    });

    it('rejects an oversized contentVersion (it lands in a JSONB row)', async () => {
      const huge = { uptime: 10, contentVersion: 'x'.repeat(65) };
      await expect(pipe.transform(huge, hbMeta)).rejects.toThrow(WsException);
    });

    it('rejects a non-string contentVersion', async () => {
      const wrongType = { uptime: 10, contentVersion: 7 };
      await expect(pipe.transform(wrongType, hbMeta)).rejects.toThrow(WsException);
    });
  });

  describe('non-body params (the prod-breaking gap)', () => {
    // Framework-injected params like @ConnectedSocket() arrive with
    // type='custom' and metatype=Socket. The pipe MUST pass these
    // through untouched — plainToInstance(Socket, ...) crashed every
    // @SubscribeMessage handler in prod until this filter landed.
    class FakeSocket {
      constructor() {
        throw new Error('Socket constructor should never be called from the pipe');
      }
    }

    it('passes through @ConnectedSocket-style param (type=custom) without transforming', async () => {
      const customMeta: ArgumentMetadata = { type: 'custom', metatype: FakeSocket as any };
      const fakeSocketInstance = { id: 'abc', data: { deviceId: 'd1' } };
      const result = await pipe.transform(fakeSocketInstance, customMeta);
      expect(result).toBe(fakeSocketInstance);
    });

    it('passes through @Param-style param (type=param) without transforming', async () => {
      const paramMeta: ArgumentMetadata = { type: 'param', metatype: String };
      const result = await pipe.transform('some-id', paramMeta);
      expect(result).toBe('some-id');
    });

    it('passes through @Query-style param (type=query) without transforming', async () => {
      const queryMeta: ArgumentMetadata = { type: 'query', metatype: TestDto };
      const arbitrary = { something: 'else' };
      const result = await pipe.transform(arbitrary, queryMeta);
      expect(result).toBe(arbitrary);
    });
  });
});

describe('content:impression — the sibling instance of the same defect', () => {
  const impMeta: ArgumentMetadata = { type: 'body', metatype: ContentImpressionDto };
  let pipe: WsValidationPipe;
  beforeEach(() => { pipe = new WsValidationPipe(true); });

  it('ACCEPTS a numeric timestamp — what BOTH shipped clients actually send', async () => {
    // vizora-tv src/main.ts:1774/:1808/:2026 and display/src/electron/
    // device-client.ts:552 both send `Date.now()`. The DTO declared @IsString(),
    // so every impression either client ever emitted was rejected before the
    // handler ran. content_impressions holds 0 rows, lifetime — this never worked.
    const shipped = { contentId: 'c1', playlistId: 'p1', duration: 15, completionPercentage: 100, timestamp: Date.now() };
    const result = await pipe.transform(shipped, impMeta);
    expect(typeof result.timestamp).toBe('number');
  });

  it('ACCEPTS an ISO string timestamp too (the format anything new should write)', async () => {
    const iso = { contentId: 'c1', timestamp: new Date('2026-08-13T00:00:00.000Z').toISOString() };
    const result = await pipe.transform(iso, impMeta);
    expect(result.timestamp).toBe('2026-08-13T00:00:00.000Z');
  });

  it('still rejects a timestamp that is neither (object)', async () => {
    await expect(pipe.transform({ contentId: 'c1', timestamp: {} }, impMeta)).rejects.toThrow(WsException);
  });

  it('still enforces the fields that matter — contentId is required', async () => {
    await expect(pipe.transform({ timestamp: Date.now() }, impMeta)).rejects.toThrow(WsException);
  });

  it('still enforces completionPercentage bounds', async () => {
    await expect(
      pipe.transform({ contentId: 'c1', completionPercentage: 101 }, impMeta),
    ).rejects.toThrow(WsException);
  });
});

describe('tolerateUnknown — telemetry degrades the field, never the envelope', () => {
  const hbMeta: ArgumentMetadata = { type: 'body', metatype: HeartbeatMessageDto };

  it('a TOLERANT pipe STRIPS an unknown field instead of dropping the heartbeat', async () => {
    // The structural close. Two separate outages came from an unknown/mistyped
    // field taking down a whole telemetry envelope. Stripping keeps the security
    // property (nothing unvalidated reaches the handler) while removing the
    // fleet-wide failure mode.
    const tolerant = new WsValidationPipe(true);
    const future = { uptime: 10, appVersion: '1.3.14', someFieldAddedLater: 'x' };
    const result = await tolerant.transform(future, hbMeta);
    expect(result.uptime).toBe(10);
    expect((result as Record<string, unknown>).someFieldAddedLater).toBeUndefined();
  });

  it('a tolerant pipe STILL rejects a genuinely invalid value', async () => {
    // Tolerance is about unknown KEYS, not bad VALUES. A wrong type on a known
    // field is a real error and must still fail.
    const tolerant = new WsValidationPipe(true);
    await expect(tolerant.transform({ uptime: 'not-a-number' }, hbMeta)).rejects.toThrow(WsException);
  });

  it('the DEFAULT pipe stays strict, so control-plane messages are unaffected', async () => {
    const strict = new WsValidationPipe();
    await expect(strict.transform({ uptime: 10, unexpected: 'x' }, hbMeta)).rejects.toThrow(WsException);
  });
});
