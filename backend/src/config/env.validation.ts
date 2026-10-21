// Stops the server at startup when a required environment variable is missing.
// Add a variable to REQUIRED when a feature that needs it is implemented,
// and keep this list in sync with .env.example.
const REQUIRED = ['MONGODB_URI'] as const;

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const missing = REQUIRED.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. Copy .env.example to backend/.env and fill it in.`,
    );
  }
  return config;
}
