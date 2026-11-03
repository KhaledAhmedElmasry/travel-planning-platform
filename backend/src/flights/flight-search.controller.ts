import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FlightSearchQueryDto } from './dto/flight-search-query.dto';
import {
  FlightSearchResponseDto,
  RoundTripFlightSearchResponseDto,
} from './dto/flight-search-response.dto';
import { FlightSearchService } from './flight-search.service';

@Controller('flights')
export class FlightSearchController {
  constructor(private readonly flightSearchService: FlightSearchService) {}

  @Get('search')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) =>
        new BadRequestException(
          errors.flatMap((error) =>
            Object.values(error.constraints ?? {}).map(
              (message) => `${error.property}: ${message}`,
            ),
          ),
        ),
    }),
  )
  search(
    @Query() query: FlightSearchQueryDto,
  ): Promise<FlightSearchResponseDto | RoundTripFlightSearchResponseDto> {
    return this.flightSearchService.search(query);
  }
}
