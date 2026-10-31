// Area: Admin, Notifications & Platform Core
// Global validation configuration with field-level messages.
// Related: GEN-02, GEN-13.
//
// This ValidationPipe is registered globally in main.ts. It validates every
// incoming @Body() and @Query() using class-validator decorators on DTOs, strips
// unknown properties (whitelist), and throws a BadRequestException whose
// response object carries the per-field error details that the global
// HttpExceptionFilter reshapes into the standard Error format (openapi.yaml).

import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
  type ValidationPipeOptions,
} from '@nestjs/common';

/**
 * Flatten a class-validator ValidationError tree into a flat array of
 * `{ field, messages }` objects, using dot notation for nested fields.
 *
 * Example: a `passengers[0].name` error becomes
 * `{ field: "passengers.0.name", messages: ["name should not be empty"] }`.
 */
function flattenErrors(
  errors: ValidationError[],
  parentPath = '',
): { field: string; messages: string[] }[] {
  const result: { field: string; messages: string[] }[] = [];

  for (const err of errors) {
    const field = parentPath
      ? `${parentPath}.${err.property}`
      : err.property;

    // Collect constraint messages for this node, if any.
    if (err.constraints) {
      result.push({ field, messages: Object.values(err.constraints) });
    }

    // Recurse into nested / array children.
    if (err.children && err.children.length > 0) {
      result.push(...flattenErrors(err.children, field));
    }
  }

  return result;
}

/**
 * Options for the global ValidationPipe. Exported so main.ts can do:
 *
 *   app.useGlobalPipes(new ValidationPipe(globalValidationPipeOptions));
 */
export const globalValidationPipeOptions: ValidationPipeOptions = {
  // Strip properties that have no decorator on the DTO.
  whitelist: true,

  // Throw when unknown (non-whitelisted) properties are sent.
  forbidNonWhitelisted: true,

  // Automatically transform payloads to the DTO class instance so that
  // class-transformer decorators (e.g. @Type) work.
  transform: true,

  // Build a BadRequestException whose `.getResponse()` includes fieldErrors,
  // which the HttpExceptionFilter picks up.
  exceptionFactory: (validationErrors: ValidationError[]) => {
    const fieldErrors = flattenErrors(validationErrors);

    return new BadRequestException({
      statusCode: 400,
      error: 'BAD_REQUEST',
      message: 'Validation failed',
      fieldErrors,
    });
  },
};
