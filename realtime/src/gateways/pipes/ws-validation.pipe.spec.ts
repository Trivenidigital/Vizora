import { ArgumentMetadata } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { WsValidationPipe } from './ws-validation.pipe';

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
});
