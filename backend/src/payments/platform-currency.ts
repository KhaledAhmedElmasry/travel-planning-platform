import { ConfigService } from '@nestjs/config';

// Area: Payments & Refunds
// PAY-04: every flight and hotel price, payment and refund uses this one currency and is
// never converted (only itinerary budgets are, ITN-18). env.validation.ts guarantees at startup
// that it is set and is a 3-letter uppercase code such as USD.
export function platformCurrency(config: ConfigService): string {
  return config.getOrThrow<string>('PLATFORM_CURRENCY');
}
