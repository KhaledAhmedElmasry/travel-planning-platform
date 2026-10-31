// Area: Admin, Notifications & Platform Core
// Global exception filter that returns one consistent error format.
// Related: PDF section 6.7, GEN-02, GEN-13.
//
// Every HTTP error — whether thrown by NestJS guards, pipes, controllers or
// services — is caught here and reshaped into the standard Error schema defined
// in docs/api/openapi.yaml:
//
//   { statusCode, error, message, fieldErrors?, path, timestamp }
//
// Register it globally in main.ts:
//   app.useGlobalFilters(new GlobalHttpExceptionFilter());

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/** Maps an HTTP status code to its short constant name, e.g. 400 → "BAD_REQUEST". */
function httpStatusLabel(status: number): string {
  // HttpStatus is an enum whose keys are the labels (BAD_REQUEST, NOT_FOUND, …).
  const entry = Object.entries(HttpStatus).find(
    ([, v]) => v === status,
  );
  return entry ? (entry[0] as string) : 'UNKNOWN_ERROR';
}

interface FieldError {
  field: string;
  messages: string[];
}

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // --- Determine status code and response body ---

    let status: number;
    let message: string;
    let fieldErrors: FieldError[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();

      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const body = exceptionResponse as Record<string, unknown>;

        // The global ValidationPipe puts the human-readable message at body.message.
        // NestJS built-in pipes may put an array in body.message.
        if (Array.isArray(body.message)) {
          message = (body.message as string[]).join('; ');
        } else if (typeof body.message === 'string') {
          message = body.message;
        } else {
          message = exception.message;
        }

        // Pick up fieldErrors set by globalValidationPipeOptions.exceptionFactory.
        if (Array.isArray(body.fieldErrors)) {
          fieldErrors = body.fieldErrors as FieldError[];
        }
      } else {
        message = exception.message;
      }
    } else {
      // Unexpected non-HTTP exceptions → 500 Internal Server Error.
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : exception,
      );
    }

    // --- Build the standard error envelope ---

    const errorResponse: Record<string, unknown> = {
      statusCode: status,
      error: httpStatusLabel(status),
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (fieldErrors && fieldErrors.length > 0) {
      errorResponse.fieldErrors = fieldErrors;
    }

    response.status(status).json(errorResponse);
  }
}
