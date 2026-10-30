// Stops the server at startup when a required environment variable is missing.
// Add a variable to REQUIRED when a feature that needs it is implemented,
// and keep this list in sync with .env.example.
// STRIPE_WEBHOOK_SECRET is not listed: it is personal (printed by `stripe listen`) and only
// checked when a webhook arrives.
const REQUIRED = [
  'MONGODB_URI',
  'STRIPE_SECRET_KEY',
  'PLATFORM_CURRENCY',
] as const;

// PLATFORM_CURRENCY (PAY-04, NEW-04): the single currency of every flight and hotel price,
// payment and refund. A 3-letter uppercase ISO 4217 code, e.g. USD. Read it with
// config.getOrThrow<string>('PLATFORM_CURRENCY') and return it with every price.
const CURRENCY_CODE = /^[A-Z]{3}$/;

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const missing = REQUIRED.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. Copy .env.example to backend/.env and fill it in.`,
    );
  }
  if (!CURRENCY_CODE.test(String(config.PLATFORM_CURRENCY))) {
    throw new Error(
      'PLATFORM_CURRENCY must be a 3-letter uppercase currency code, e.g. USD (PAY-04).',
    );
  }
  return config;
}
