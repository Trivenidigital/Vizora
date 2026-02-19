import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';

describe('MetricsInterceptor', () => {
  let interceptor: MetricsInterceptor;
  let mockMetricsService: any;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    mockMetricsService = {
      httpRequestsTotal: { inc: jest.fn() },
      httpRequestDuration: { observe: jest.fn() },
      httpErrorsTotal: { inc: jest.fn() },
    };

    mockRequest = {
      method: 'GET',
      url: '/api/content',
      route: { path: '/api/content' },
    };

    mockResponse = {
      statusCode: 200,
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    } as unknown as ExecutionContext;

    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ data: 'test' })),
    };

    interceptor = new MetricsInterceptor(mockMetricsService as MetricsService);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept - successful requests', () => {
    it('should increment httpRequestsTotal on success', (done) => {
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        complete: () => {
          expect(mockMetricsService.httpRequestsTotal.inc).toHaveBeenCalledWith({
            method: 'GET',
            path: '/api/content',
            status: '200',
          });
          done();
        },
      });
    });

    it('should observe httpRequestDuration on success', (done) => {
      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        complete: () => {
          expect(mockMetricsService.httpRequestDuration.observe).toHaveBeenCalledWith(
            { method: 'GET', path: '/api/content', status: '200' },
            expect.any(Number),
          );
          done();
        },
      });
    });

    it('should not increment httpErrorsTotal for 2xx responses', (done) => {
      mockResponse.statusCode = 200;

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        complete: () => {
          expect(mockMetricsService.httpErrorsTotal.inc).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it('should increment httpErrorsTotal for 4xx responses', (done) => {
      mockResponse.statusCode = 404;

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        complete: () => {
          expect(mockMetricsService.httpErrorsTotal.inc).toHaveBeenCalledWith({
            method: 'GET',
            path: '/api/content',
            status: '404',
          });
          done();
        },
      });
    });

    it('should increment httpErrorsTotal for 5xx responses', (done) => {
      mockResponse.statusCode = 500;

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        complete: () => {
          expect(mockMetricsService.httpErrorsTotal.inc).toHaveBeenCalled();
          done();
        },
      });
    });
  });

  describe('intercept - error requests', () => {
    it('should record metrics on error', (done) => {
      const error = { status: 500, message: 'Internal Server Error' };
      mockCallHandler.handle = jest.fn().mockReturnValue(throwError(() => error));

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        error: () => {
          expect(mockMetricsService.httpRequestsTotal.inc).toHaveBeenCalledWith({
            method: 'GET',
            path: '/api/content',
            status: '500',
          });
          expect(mockMetricsService.httpRequestDuration.observe).toHaveBeenCalled();
          expect(mockMetricsService.httpErrorsTotal.inc).toHaveBeenCalledWith({
            method: 'GET',
            path: '/api/content',
            status: '500',
          });
          done();
        },
      });
    });

    it('should default to status 500 when error has no status', (done) => {
      const error = { message: 'Something went wrong' };
      mockCallHandler.handle = jest.fn().mockReturnValue(throwError(() => error));

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        error: () => {
          expect(mockMetricsService.httpRequestsTotal.inc).toHaveBeenCalledWith(
            expect.objectContaining({ status: '500' }),
          );
          done();
        },
      });
    });

    it('should use error status when available', (done) => {
      const error = { status: 403, message: 'Forbidden' };
      mockCallHandler.handle = jest.fn().mockReturnValue(throwError(() => error));

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        error: () => {
          expect(mockMetricsService.httpRequestsTotal.inc).toHaveBeenCalledWith(
            expect.objectContaining({ status: '403' }),
          );
          done();
        },
      });
    });
  });

  describe('path normalization', () => {
    it('should replace UUIDs with :id', (done) => {
      mockRequest.route = { path: '/api/content/550e8400-e29b-41d4-a716-446655440000' };

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        complete: () => {
          expect(mockMetricsService.httpRequestsTotal.inc).toHaveBeenCalledWith(
            expect.objectContaining({ path: '/api/content/:id' }),
          );
          done();
        },
      });
    });

    it('should replace numeric IDs with :id', (done) => {
      mockRequest.route = { path: '/api/users/12345' };

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        complete: () => {
          expect(mockMetricsService.httpRequestsTotal.inc).toHaveBeenCalledWith(
            expect.objectContaining({ path: '/api/users/:id' }),
          );
          done();
        },
      });
    });

    it('should use request.url when route.path is not available', (done) => {
      mockRequest.route = undefined;
      mockRequest.url = '/api/health';

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        complete: () => {
          expect(mockMetricsService.httpRequestsTotal.inc).toHaveBeenCalledWith(
            expect.objectContaining({ path: '/api/health' }),
          );
          done();
        },
      });
    });

    it('should handle multiple UUIDs in path', (done) => {
      mockRequest.route = { path: '/api/orgs/550e8400-e29b-41d4-a716-446655440000/displays/660e8400-e29b-41d4-a716-446655440001' };

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        complete: () => {
          expect(mockMetricsService.httpRequestsTotal.inc).toHaveBeenCalledWith(
            expect.objectContaining({ path: '/api/orgs/:id/displays/:id' }),
          );
          done();
        },
      });
    });
  });
});
