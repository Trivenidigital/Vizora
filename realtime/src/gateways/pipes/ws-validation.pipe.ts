import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException, Logger } from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { WsException } from '@nestjs/websockets';

/**
 * WebSocket-specific validation pipe
 * Validates incoming WebSocket message payloads against DTOs
 */
@Injectable()
export class WsValidationPipe implements PipeTransform {
  private readonly logger = new Logger(WsValidationPipe.name);

  async transform(value: unknown, metadata: ArgumentMetadata) {
    const { metatype, type } = metadata;

    // Only validate @MessageBody() params. @ConnectedSocket() and other
    // framework-injected parameters arrive here as `type !== 'body'` and
    // their metatypes (Socket, Server, etc.) MUST NOT be passed to
    // plainToInstance — Socket's constructor requires an internal server
    // reference that class-transformer can't supply, and the resulting
    // crash silently aborted every @SubscribeMessage handler. R10 E2E
    // scout finding #1 (heartbeat/content:impression/playlist:request
    // all failed in prod with "Cannot read properties of undefined
    // (reading 'server')" until this filter was added).
    if (type !== 'body') {
      return value;
    }

    // Skip validation if no metatype or if it's a primitive type
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // Reject null / undefined payloads explicitly. class-validator's
    // ValidationExecutor calls `.constructor` on the value and crashes
    // on null with "Cannot read properties of null (reading 'constructor')"
    // — that crash bubbled up as an unhandled WsException, abandoning
    // the handler. Map to a clean validation error instead.
    if (value === null || value === undefined || typeof value !== 'object') {
      throw new WsException({
        error: 'Validation failed',
        details: { payload: ['payload must be a non-null object'] },
      });
    }

    // Transform plain object to class instance
    const object = plainToInstance(metatype, value);

    // Validate the object
    const errors = await validate(object, {
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw error on unknown properties
      forbidUnknownValues: true,
    });

    if (errors.length > 0) {
      const formattedErrors = this.formatErrors(errors);
      this.logger.warn(`WebSocket validation failed: ${JSON.stringify(formattedErrors)}`);
      throw new WsException({
        error: 'Validation failed',
        details: formattedErrors,
      });
    }

    return object;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private formatErrors(errors: ValidationError[]): Record<string, string[]> {
    const result: Record<string, string[]> = {};

    for (const error of errors) {
      const property = error.property;
      const constraints = error.constraints;

      if (constraints) {
        result[property] = Object.values(constraints);
      }

      // Handle nested validation errors
      if (error.children && error.children.length > 0) {
        const nestedErrors = this.formatErrors(error.children);
        for (const [nestedProp, nestedMessages] of Object.entries(nestedErrors)) {
          result[`${property}.${nestedProp}`] = nestedMessages;
        }
      }
    }

    return result;
  }
}

/**
 * Validate a plain object against a DTO class manually
 * Useful for validating objects outside of the pipe context
 */
export async function validateDto<T extends object>(
  dtoClass: new () => T,
  plainObject: unknown,
): Promise<{ valid: boolean; errors?: Record<string, string[]>; data?: T }> {
  const object = plainToInstance(dtoClass, plainObject);
  const errors = await validate(object, {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  });

  if (errors.length > 0) {
    const formattedErrors: Record<string, string[]> = {};
    for (const error of errors) {
      if (error.constraints) {
        formattedErrors[error.property] = Object.values(error.constraints);
      }
    }
    return { valid: false, errors: formattedErrors };
  }

  return { valid: true, data: object };
}
