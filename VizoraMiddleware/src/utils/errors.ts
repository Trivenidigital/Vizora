export enum ErrorCode {
  // Session Errors
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INVALID_RECONNECTION_TOKEN = 'INVALID_RECONNECTION_TOKEN',

  // Display Errors
  DISPLAY_NOT_FOUND = 'DISPLAY_NOT_FOUND',
  DISPLAY_REGISTRATION_FAILED = 'DISPLAY_REGISTRATION_FAILED',
  DISPLAY_ALREADY_REGISTERED = 'DISPLAY_ALREADY_REGISTERED',

  // Pairing Errors
  INVALID_PAIRING_CODE = 'INVALID_PAIRING_CODE',
  PAIRING_EXPIRED = 'PAIRING_EXPIRED',
  ALREADY_PAIRED = 'ALREADY_PAIRED',
  NOT_AUTHORIZED = 'NOT_AUTHORIZED',

  // Content Update Errors
  CONTENT_UPDATE_FAILED = 'CONTENT_UPDATE_FAILED',
  INVALID_CONTENT = 'INVALID_CONTENT',

  // Connection Errors
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  SOCKET_ERROR = 'SOCKET_ERROR',

  // Cluster Errors
  NODE_NOT_FOUND = 'NODE_NOT_FOUND',
  MIGRATION_FAILED = 'MIGRATION_FAILED',

  // Redis Errors
  REDIS_CONNECTION_ERROR = 'REDIS_CONNECTION_ERROR',
  REDIS_OPERATION_FAILED = 'REDIS_OPERATION_FAILED',

  // General Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

export interface ErrorResponse {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export class VizoraError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'VizoraError';
  }

  toResponse(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
      details: this.details
    };
  }
}

export function handleError(error: unknown): ErrorResponse {
  if (error instanceof VizoraError) {
    return error.toResponse();
  }

  if (error instanceof Error) {
    return {
      code: ErrorCode.INTERNAL_ERROR,
      message: error.message
    };
  }

  return {
    code: ErrorCode.INTERNAL_ERROR,
    message: 'An unexpected error occurred'
  };
}

export function isOperational(error: unknown): boolean {
  return error instanceof VizoraError;
}

export class WebSocketError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'WebSocketError';
  }
}

export class RedisError extends Error {
  constructor(
    message: string,
    public operation: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'RedisError';
  }
}

export const ErrorCodes = {
  DISPLAY_NOT_FOUND: 'DISPLAY_NOT_FOUND',
  INVALID_PAIRING_CODE: 'INVALID_PAIRING_CODE',
  UNAUTHORIZED: 'UNAUTHORIZED',
  REDIS_ERROR: 'REDIS_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

export function handleError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(typeof error === 'string' ? error : 'An unknown error occurred');
} 