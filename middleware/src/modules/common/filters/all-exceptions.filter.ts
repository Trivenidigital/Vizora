import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() === 'ws') {
      return;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Only expose internal error messages in LOCAL development. Staging
    // and any other non-production env share a production-like blast
    // radius — a leaked exception message can contain DB connection
    // strings, file paths, or other internal-only data. The previous
    // `isProduction` check let staging through as if it were dev.
    const exposeInternals = process.env.NODE_ENV === 'development';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Log server errors fully
      if (status >= 500) {
        this.logger.error(
          `HTTP ${status} ${request.method} ${request.url}`,
          exception.stack,
        );
      }

      // For HttpExceptions, return the NestJS-formatted response as-is
      response.status(status).json(
        typeof exceptionResponse === 'string'
          ? { statusCode: status, message: exceptionResponse }
          : exceptionResponse,
      );
      return;
    }

    // Non-HttpException: unknown/unexpected error
    const errorMessage =
      exception instanceof Error ? exception.message : 'Unknown error';
    const errorStack =
      exception instanceof Error ? exception.stack : undefined;

    this.logger.error(
      `Unhandled exception on ${request.method} ${request.url}: ${errorMessage}`,
      errorStack,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: exposeInternals ? errorMessage : 'Internal server error',
      ...(exposeInternals ? { error: 'Internal Server Error' } : {}),
    });
  }
}
