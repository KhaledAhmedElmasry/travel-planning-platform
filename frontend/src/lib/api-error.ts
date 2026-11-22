// The one error format every backend endpoint returns (openapi `Error`, GEN-02):
// { statusCode, error, message, fieldErrors?: [{ field, messages[] }], path, timestamp }

export type ApiError = {
  statusCode: number;
  error: string;
  message: string;
  fieldErrors?: { field: string; messages: string[] }[];
  path?: string;
  timestamp?: string;
};

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ApiError).statusCode === "number" &&
    typeof (value as ApiError).message === "string"
  );
}

/**
 * Turns `fieldErrors` into { email: "email must be an email", ... } so each
 * <FormField error={errors.email}> can show its own message under the input.
 * Nested fields keep the backend's dotted name, e.g. "passengers.0.fullName".
 */
export function fieldErrorMap(error: unknown): Record<string, string> {
  if (!isApiError(error) || !error.fieldErrors) return {};
  return Object.fromEntries(
    error.fieldErrors.map(({ field, messages }) => [field, messages.join(" ")]),
  );
}
