import { Controller } from '@nestjs/common';

// Area: Itineraries
// Requirements: ITN-18, PAY-04
// Endpoints to implement (PDF section 8):
//   none of its own. GET /api/itineraries/:id/budget-summary?currency=... (itineraries module)
//   calls ExchangeRatesService for conversion (ITN-18).
// Notes:
//   Retrieve rates from FXRatesAPI through the backend only (PDF section 6.5).
//   Handle invalid currency codes, unavailable rates and API failures (PDF section 6.5).
//   The supported currency list is seeded at setup (GEN-12).
@Controller('exchange-rates')
export class ExchangeRatesController {}
