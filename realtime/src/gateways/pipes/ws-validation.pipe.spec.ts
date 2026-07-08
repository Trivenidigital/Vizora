import { ArgumentMetadata } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { WsValidationPipe } from './ws-validation.pipe';
import { HeartbeatMessageDto } from '../dto';

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
