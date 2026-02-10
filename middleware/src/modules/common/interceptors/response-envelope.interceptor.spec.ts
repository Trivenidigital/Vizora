import { ResponseEnvelopeInterceptor, SKIP_ENVELOPE_KEY } from './response-envelope.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';

describe('ResponseEnvelopeInterceptor', () => {
  let interceptor: ResponseEnvelopeInterceptor;
  let mockReflector: Partial<Reflector>;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    };

    mockExecutionContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ id: 1, name: 'test' })),
    };

    interceptor = new ResponseEnvelopeInterceptor(mockReflector as Reflector);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('envelope wrapping', () => {
    it('should wrap response data in envelope', (done) => {
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe((response) => {
        expect(response).toEqual({
          success: true,
          data: { id: 1, name: 'test' },
        });
        done();
      });
    });

    it('should wrap array data in envelope', (done) => {
      mockCallHandler.handle = jest.fn().mockReturnValue(of([1, 2, 3]));

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe((response) => {
        expect(response).toEqual({
          success: true,
          data: [1, 2, 3],
        });
        done();
      });
    });

    it('should wrap string data in envelope', (done) => {
      mockCallHandler.handle = jest.fn().mockReturnValue(of('hello'));

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe((response) => {
        expect(response).toEqual({
          success: true,
          data: 'hello',
        });
        done();
      });
    });

    it('should wrap number data in envelope', (done) => {
      mockCallHandler.handle = jest.fn().mockReturnValue(of(42));

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe((response) => {
        expect(response).toEqual({
          success: true,
          data: 42,
        });
        done();
      });
    });

    it('should wrap null data in envelope', (done) => {
      mockCallHandler.handle = jest.fn().mockReturnValue(of(null));

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe((response) => {
        expect(response).toEqual({
          success: true,
          data: null,
        });
        done();
      });
    });

    it('should wrap undefined data in envelope', (done) => {
      mockCallHandler.handle = jest.fn().mockReturnValue(of(undefined));

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe((response) => {
        expect(response).toEqual({
          success: true,
          data: undefined,
        });
        done();
      });
    });

    it('should wrap boolean data in envelope', (done) => {
      mockCallHandler.handle = jest.fn().mockReturnValue(of(true));

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe((response) => {
        expect(response).toEqual({
          success: true,
          data: true,
        });
        done();
      });
    });
  });

  describe('double-wrap prevention', () => {
    it('should not double-wrap responses that already have success property', (done) => {
      const alreadyWrapped = { success: true, data: { id: 1 } };
      mockCallHandler.handle = jest.fn().mockReturnValue(of(alreadyWrapped));

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe((response) => {
        expect(response).toEqual(alreadyWrapped);
        // Should NOT be { success: true, data: { success: true, data: { id: 1 } } }
        expect(response.data).not.toHaveProperty('success');
        done();
      });
    });

    it('should not wrap responses with success: false', (done) => {
      const errorResponse = { success: false, error: 'something failed' };
      mockCallHandler.handle = jest.fn().mockReturnValue(of(errorResponse));

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe((response) => {
        expect(response).toEqual(errorResponse);
        done();
      });
    });
  });

  describe('SkipEnvelope decorator', () => {
    it('should skip wrapping when @SkipEnvelope is applied', (done) => {
      (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(true);

      const rawData = { id: 1, name: 'test' };
      mockCallHandler.handle = jest.fn().mockReturnValue(of(rawData));

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe((response) => {
        expect(response).toEqual(rawData);
        expect(response).not.toHaveProperty('success');
        done();
      });
    });

    it('should check reflector with correct metadata key', () => {
      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        SKIP_ENVELOPE_KEY,
        [
          (mockExecutionContext as any).getHandler(),
          (mockExecutionContext as any).getClass(),
        ],
      );
    });
  });
});
