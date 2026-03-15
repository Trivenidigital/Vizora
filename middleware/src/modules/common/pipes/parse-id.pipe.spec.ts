import { BadRequestException } from '@nestjs/common';
import { ParseIdPipe } from './parse-id.pipe';

describe('ParseIdPipe', () => {
  let pipe: ParseIdPipe;

  beforeEach(() => {
    pipe = new ParseIdPipe();
  });

  describe('UUID format', () => {
    it('should accept valid UUID v4', () => {
      expect(pipe.transform('550e8400-e29b-41d4-a716-446655440000')).toBe(
        '550e8400-e29b-41d4-a716-446655440000',
      );
    });

    it('should accept uppercase UUID', () => {
      expect(pipe.transform('550E8400-E29B-41D4-A716-446655440000')).toBe(
        '550E8400-E29B-41D4-A716-446655440000',
      );
    });

    it('should accept UUID from production Display model', () => {
      expect(pipe.transform('40f404bc-cac1-41d0-9845-f08da16a4f8b')).toBe(
        '40f404bc-cac1-41d0-9845-f08da16a4f8b',
      );
    });
  });

  describe('CUID format', () => {
    it('should accept valid CUID', () => {
      expect(pipe.transform('cmm51bbdw000h12315wr7in5n')).toBe(
        'cmm51bbdw000h12315wr7in5n',
      );
    });

    it('should accept longer CUIDs', () => {
      expect(pipe.transform('clh2k3j4g0000qw08a1b2c3d4e5')).toBe(
        'clh2k3j4g0000qw08a1b2c3d4e5',
      );
    });

    it('should accept CUID from production Content model', () => {
      expect(pipe.transform('cmm51bbdw000h12315wr7in5n')).toBe(
        'cmm51bbdw000h12315wr7in5n',
      );
    });
  });

  describe('invalid values', () => {
    it('should reject empty string', () => {
      expect(() => pipe.transform('')).toThrow(BadRequestException);
    });

    it('should reject random string', () => {
      expect(() => pipe.transform('not-an-id')).toThrow(BadRequestException);
    });

    it('should reject SQL injection attempt', () => {
      expect(() => pipe.transform("'; DROP TABLE users; --")).toThrow(BadRequestException);
    });

    it('should reject path traversal', () => {
      expect(() => pipe.transform('../../../etc/passwd')).toThrow(BadRequestException);
    });

    it('should reject incomplete UUID', () => {
      expect(() => pipe.transform('550e8400-e29b-41d4')).toThrow(BadRequestException);
    });

    it('should reject CUID that does not start with c', () => {
      expect(() => pipe.transform('xmm51bbdw000h12315wr7in5n')).toThrow(BadRequestException);
    });

    it('should reject too-short CUID', () => {
      expect(() => pipe.transform('cabcdef123')).toThrow(BadRequestException);
    });
  });

  describe('whitespace handling', () => {
    it('should trim whitespace from valid UUID', () => {
      expect(pipe.transform('  550e8400-e29b-41d4-a716-446655440000  ')).toBe(
        '550e8400-e29b-41d4-a716-446655440000',
      );
    });

    it('should trim whitespace from valid CUID', () => {
      expect(pipe.transform('  cmm51bbdw000h12315wr7in5n  ')).toBe(
        'cmm51bbdw000h12315wr7in5n',
      );
    });
  });
});
