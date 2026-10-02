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
    /**
     * Machine-readable discriminator from the error body, for endpoints that
     * publish one (the backend convention is a SCREAMING_SNAKE `code`, e.g.
     * `DEVICE_IDENTIFIER_IN_USE`). Callers that need to tell two failures of
     * the same status apart should switch on this, never on `message`.
     */
    public code?: string,
    /**
     * The parsed error body. This is DATA, not copy — it may contain
     * arbitrary backend text. Read named, validated fields out of it; never
     * render a value from here directly.
     */
    public details?: Record<string, unknown>,
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

/*
 * A status PHRASE is not an error message.
 *
 * `middleware/src/main.ts` sets `disableErrorMessages: true` on the global
 * ValidationPipe when NODE_ENV is production, so a DTO rejection there returns
 * `{ statusCode: 400, message: 'Bad Request' }` with no field detail at all.
 * `buildApiError` faithfully lifts that `message`, and the register page
 * faithfully rendered it — which is how a real sign-up attempt ended at a red
 * banner reading only "Bad Request".
 *
 * So the client cannot invent detail the server withheld. What it CAN stop doing
 * is presenting an HTTP status phrase as if it were an explanation.
 */
const BARE_STATUS_PHRASE =
  /^(bad request|unauthorized|forbidden|not found|conflict|gone|unprocessable entity|too many requests|internal server error|bad gateway|service unavailable|http \d{3})\.?$/i;

export function isBareStatusPhrase(message: unknown): boolean {
  return typeof message === 'string' && BARE_STATUS_PHRASE.test(message.trim());
}

/**
 * The message to show a user for a failed request, never a bare status phrase.
 *
 * Prefers the server's own text, falls back to the status-derived copy that
 * `buildApiError` already computed, and only then to the caller's fallback.
 */
export function userFacingMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) {
    if (error.message && !isBareStatusPhrase(error.message)) return error.message;
    if (error.userMessage && !isBareStatusPhrase(error.userMessage)) return error.userMessage;
    return fallback;
  }
  if (error instanceof Error && error.message && !isBareStatusPhrase(error.message)) {
    return error.message;
  }
  return fallback;
}

/**
 * Split class-validator's message array onto the fields it names.
 *
 * Nest returns `message` as an ARRAY of strings for a DTO rejection, each of
 * which begins with the offending property — "lastName must be longer than or
 * equal to 2 characters". Attaching them to their field puts the correction where
 * the user is looking instead of in a banner above the form.
 *
 * Only fields the caller names are matched, so arbitrary server text can never
 * invent a key. Anything unmatched is returned under `_` for the banner, because
 * dropping a message the server bothered to send is how an opaque failure
 * survives a fix.
 */
export function fieldErrorsFromApiError(
  error: unknown,
  fields: readonly string[],
): { fieldErrors: Record<string, string>; rest: string[] } {
  const fieldErrors: Record<string, string> = {};
  const rest: string[] = [];
  if (!isApiError(error)) return { fieldErrors, rest };

  const raw = error.details?.message;
  const messages = Array.isArray(raw) ? raw.filter((m): m is string => typeof m === 'string') : [];

  for (const message of messages) {
    // class-validator prefixes the property name; match the longest field first
    // so `organizationName` is not claimed by a hypothetical `organization`.
    const field = [...fields]
      .sort((a, b) => b.length - a.length)
      .find((f) => message.startsWith(`${f} `));
    if (field && !fieldErrors[field]) {
      fieldErrors[field] = message;
    } else if (!field) {
      rest.push(message);
    }
  }
  return { fieldErrors, rest };
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
