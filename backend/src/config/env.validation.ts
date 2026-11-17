// Stops the server at startup when a required environment variable is missing.
// Add a variable to REQUIRED when a feature that needs it is implemented,
// and keep this list in sync with .env.example.
// STRIPE_WEBHOOK_SECRET is not listed: it is personal (printed by `stripe listen`) and only
// checked when a webhook arrives.
const REQUIRED = [
  'MONGODB_URI',
  'JWT_ACCESS_SECRET', // ACC-04, ACC-19
  'JWT_REFRESH_SECRET', // ACC-19
  'STRIPE_SECRET_KEY',
  'PLATFORM_CURRENCY',
] as const;
// FXRATES_API_KEY (ITN-18) is optional: the free FXRatesAPI endpoint answers without a key; when
// it is set, it is sent with every request.

// PLATFORM_CURRENCY (PAY-04): the single currency of every flight and hotel price,
// payment and refund. A 3-letter uppercase ISO 4217 code, e.g. USD. Read it with
// config.getOrThrow<string>('PLATFORM_CURRENCY') and return it with every price.
const CURRENCY_CODE = /^[A-Z]{3}$/;

const STRIPE_TEST_KEY = /^(sk|rk)_test_/;

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const missing = REQUIRED.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. Copy .env.example to backend/.env and fill it in.`,
    );
  }
  // PAY-01, PDF 6.4: payments use Stripe in test mode only. A live key (sk_live_...) or a
  // publishable key would charge real cards or not work at all.
  if (!STRIPE_TEST_KEY.test(String(config.STRIPE_SECRET_KEY))) {
    throw new Error(
      'STRIPE_SECRET_KEY must be a Stripe test-mode secret key (sk_test_... or rk_test_...). Live keys are not allowed (PAY-01).',
    );
  }
  if (!CURRENCY_CODE.test(String(config.PLATFORM_CURRENCY))) {
    throw new Error(
      'PLATFORM_CURRENCY must be a 3-letter uppercase currency code, e.g. USD (PAY-04).',
    );
  }
  return config;
}
