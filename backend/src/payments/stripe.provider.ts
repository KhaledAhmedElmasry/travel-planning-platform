import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

// Area: Payments & Refunds
// One Stripe client (test mode key) for the whole app. Inject it with @Inject(STRIPE_CLIENT).
export const STRIPE_CLIENT = Symbol('STRIPE_CLIENT');

export const stripeProvider: Provider = {
  provide: STRIPE_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    new Stripe(config.getOrThrow<string>('STRIPE_SECRET_KEY')),
};
