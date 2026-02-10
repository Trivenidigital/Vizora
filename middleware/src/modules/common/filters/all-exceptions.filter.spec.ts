import { AllExceptionsFilter } from './all-exceptions.filter';
import { ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: any;

  beforeEach(() => {
    filter = new AllExceptionsFilter();

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      method: 'GET',
      url: '/api/test',
    };

    mockHost = {
      getType: jest.fn().mockReturnValue('http'),
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  describe('WebSocket context', () => {
    it('should return early for ws context type', () => {
      mockHost.getType.mockReturnValue('ws');

      filter.catch(new Error('test'), mockHost);

      expect(mockHost.switchToHttp).not.toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('HttpException handling', () => {
    it('should handle HttpException with string response', () => {
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Not Found',
      });
    });

    it('should handle HttpException with object response', () => {
      const responseBody = {
        statusCode: 400,
        message: ['email must be an email'],
        error: 'Bad Request',
      };
      const exception = new HttpException(responseBody, HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(responseBody);
    });

    it('should handle 400 Bad Request', () => {
      const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should handle 401 Unauthorized', () => {
      const exception = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should handle 403 Forbidden', () => {
      const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should handle 409 Conflict', () => {
      const exception = new HttpException('Conflict', HttpStatus.CONFLICT);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
    });

    it('should handle 422 Unprocessable Entity', () => {
      const exception = new HttpException('Unprocessable Entity', HttpStatus.UNPROCESSABLE_ENTITY);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
    });

    it('should handle 429 Too Many Requests', () => {
      const exception = new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
    });

    it('should log server errors (status >= 500)', () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error');
      const exception = new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);

      filter.catch(exception, mockHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('HTTP 500'),
        expect.anything(),
      );
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    it('should log 502 Bad Gateway as server error', () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error');
      const exception = new HttpException('Bad Gateway', HttpStatus.BAD_GATEWAY);

      filter.catch(exception, mockHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('HTTP 502'),
        expect.anything(),
      );
    });

    it('should log 503 Service Unavailable as server error', () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error');
      const exception = new HttpException('Service Unavailable', HttpStatus.SERVICE_UNAVAILABLE);

      filter.catch(exception, mockHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('HTTP 503'),
        expect.anything(),
      );
    });

    it('should NOT log client errors (status < 500)', () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error');
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockHost);

      expect(loggerSpy).not.toHaveBeenCalled();
    });

    it('should include method and url in server error log', () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error');
      mockRequest.method = 'POST';
      mockRequest.url = '/api/v1/content';
      const exception = new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);

      filter.catch(exception, mockHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('POST /api/v1/content'),
        expect.anything(),
      );
    });
  });

  describe('Non-HttpException handling', () => {
    it('should handle standard Error with 500 status', () => {
      const exception = new Error('Something broke');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should return error message in non-production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const exception = new Error('Database connection failed');

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Database connection failed',
          error: 'Internal Server Error',
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should hide error details in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const exception = new Error('Sensitive database error details');

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'Internal server error',
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should log unknown errors with stack trace', () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error');
      const exception = new Error('Unexpected error');

      filter.catch(exception, mockHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unexpected error'),
        exception.stack,
      );
    });

    it('should handle non-Error exceptions (string)', () => {
      filter.catch('string error', mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
        }),
      );
    });

    it('should handle non-Error exceptions (number)', () => {
      filter.catch(42, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should handle non-Error exceptions (null)', () => {
      filter.catch(null, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should handle non-Error exceptions (undefined)', () => {
      filter.catch(undefined, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should log "Unknown error" for non-Error exceptions', () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error');

      filter.catch('some string', mockHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown error'),
        undefined,
      );
    });

    it('should include request method and URL in log for unknown errors', () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error');
      mockRequest.method = 'DELETE';
      mockRequest.url = '/api/v1/devices/123';

      filter.catch(new Error('fail'), mockHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('DELETE /api/v1/devices/123'),
        expect.anything(),
      );
    });

    it('should not include error property in production response', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      filter.catch(new Error('sensitive'), mockHost);

      const jsonCall = mockResponse.json.mock.calls[0][0];
      expect(jsonCall).not.toHaveProperty('error');

      process.env.NODE_ENV = originalEnv;
    });

    it('should include error property in non-production response', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      filter.catch(new Error('test error'), mockHost);

      const jsonCall = mockResponse.json.mock.calls[0][0];
      expect(jsonCall).toHaveProperty('error', 'Internal Server Error');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('HttpException with validation errors', () => {
    it('should pass through NestJS validation pipe format', () => {
      const validationResponse = {
        statusCode: 400,
        message: [
          'name must be a string',
          'email must be an email',
        ],
        error: 'Bad Request',
      };
      const exception = new HttpException(validationResponse, HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(validationResponse);
    });
  });
});
