import { validateEnv } from './env.validation';

// The server must not start with a configuration the project description forbids:
// PAY-01 / PDF 6.4: payments use Stripe in TEST mode only; PAY-04: one platform currency.
describe('validateEnv', () => {
  const valid = {
    MONGODB_URI: 'mongodb+srv://u:p@cluster.example.net/db',
    JWT_ACCESS_SECRET: 'access-secret',
    JWT_REFRESH_SECRET: 'refresh-secret',
    STRIPE_SECRET_KEY: 'sk_test_51abc',
    PLATFORM_CURRENCY: 'USD',
  };

  it('accepts a complete test-mode configuration', () => {
    expect(validateEnv({ ...valid })).toEqual(valid);
  });

  it('accepts a restricted test key', () => {
    expect(() =>
      validateEnv({ ...valid, STRIPE_SECRET_KEY: 'rk_test_51abc' }),
    ).not.toThrow();
  });

  it.each([
    ['a live secret key', 'sk_live_51abc'],
    ['a live restricted key', 'rk_live_51abc'],
    ['a publishable key', 'pk_test_51abc'],
    ['something else', 'not-a-stripe-key'],
  ])('refuses %s (Stripe test mode only)', (_case, key) => {
    expect(() => validateEnv({ ...valid, STRIPE_SECRET_KEY: key })).toThrow(
      /test/i,
    );
  });

  it.each(Object.keys(valid))('refuses a missing %s', (name) => {
    const config: Record<string, unknown> = { ...valid };
    delete config[name];
    expect(() => validateEnv(config)).toThrow(name);
  });

  it.each(['usd', 'US', 'DOLLAR'])(
    'refuses the platform currency %s (3 uppercase letters, PAY-04)',
    (currency) => {
      expect(() =>
        validateEnv({ ...valid, PLATFORM_CURRENCY: currency }),
      ).toThrow(/PLATFORM_CURRENCY/);
    },
  );
});
