/**
 * Centralized error handling utility
 * Handles logging, user-friendly messages, and error tracking
 */

import { captureException } from './sentry';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public userMessage: string = message,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Log error appropriately based on environment
 */
export function logError(error: unknown, context?: string): void {
  const timestamp = new Date().toISOString();

  if (process.env.NODE_ENV === 'development') {
    console.error(`[${timestamp}] ${context || 'Error'}:`, error);
  } else {
    // In production, report to Sentry (no-ops if DSN not configured)
    captureException(error, { context, timestamp });
    console.error(`[${timestamp}] ${context || 'Error'}:`, error instanceof Error ? error.message : error);
  }
}

/**
 * Get user-friendly error message based on error type
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.userMessage;
  }

  if (error instanceof TypeError) {
    return 'A network error occurred. Please check your connection.';
  }

  if (error instanceof Error && error.message === 'Request timeout') {
    return 'The request took too long. Please try again.';
  }

  if (error instanceof Error) {
    // Check if it contains sensitive information
    if (error.message.includes('SQL') || error.message.includes('database')) {
      return 'A server error occurred. Please try again later.';
    }
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Handle fetch response and throw appropriate errors
 */
export async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const statusCode = response.status;
    let errorData: any = { message: 'Request failed' };

    try {
      errorData = await response.json();
    } catch {
      // Response is not JSON, use default error message
    }

    const errorMessage = errorData?.message || `HTTP ${statusCode}`;
    let userMessage = errorMessage;

    // Map HTTP status codes to user-friendly messages
    switch (statusCode) {
      case 400:
        userMessage = 'Invalid request. Please check your input.';
        break;
      case 401:
        userMessage = 'Your session has expired. Please log in again.';
        break;
      case 403:
        userMessage = 'You do not have permission to access this resource.';
        break;
      case 404:
        userMessage = 'The requested resource was not found.';
        break;
      case 409:
        userMessage = errorMessage; // Conflict messages are usually user-friendly
        break;
      case 422:
        userMessage = 'Please check your input and try again.';
        break;
      case 429:
        userMessage = 'Too many requests. Please wait a moment and try again.';
        break;
      case 500:
        userMessage = 'A server error occurred. Please try again later.';
        break;
      case 502:
      case 503:
        userMessage = 'The service is temporarily unavailable. Please try again later.';
        break;
    }

    throw new ApiError(statusCode, errorMessage, userMessage);
  }

  return response.json() as Promise<T>;
}
