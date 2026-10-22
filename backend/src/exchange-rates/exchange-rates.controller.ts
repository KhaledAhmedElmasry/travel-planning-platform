import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ExchangeRatesService } from './exchange-rates.service';

// Area: Itineraries
// Requirements: ITN-18, NEW-04
// Endpoints to implement (PDF section 8):
//   (add endpoints as needed, PDF section 8.10), e.g. GET /api/exchange-rates?base=USD   ITN-18
//   The budget summary (itineraries module) calls ExchangeRatesService for conversion.
// Notes:
//   Retrieve rates from FXRatesAPI through the backend only (PDF section 6.5).
//   Handle invalid currency codes, unavailable rates and API failures (PDF section 6.5).
//   The supported currency list is seeded at setup (GEN-12).
@ApiTags('Exchange Rates')
@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  // TODO: add the endpoints listed above.
}
