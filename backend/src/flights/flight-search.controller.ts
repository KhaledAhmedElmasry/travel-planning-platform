// Requirements: FLT-11, GEN-02, GEN-04, GEN-05, GEN-13.
import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FlightSearchQueryDto } from './dto/flight-search-query.dto';
import { FlightSearchResponseDto } from './dto/flight-search-response.dto';
import { FlightSearchService } from './flight-search.service';

@ApiTags('Flights')
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
  @ApiOperation({
    summary: 'Search scheduled flights (FLT-11)',
    description:
      'Public search by departure, arrival, local departure date, and passengers. Requirements: FLT-11, GEN-02, GEN-04, GEN-05, GEN-06, GEN-13.',
  })
  @ApiQuery({ name: 'from', required: true, type: String, example: 'CAI' })
  @ApiQuery({ name: 'to', required: true, type: String, example: 'DXB' })
  @ApiQuery({
    name: 'date',
    required: true,
    type: String,
    example: '2026-11-02',
  })
  @ApiQuery({ name: 'passengers', required: true, type: Number, example: 2 })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiOkResponse({ type: FlightSearchResponseDto })
  @ApiBadRequestResponse({
    description: 'The query is invalid or an airport code is unknown.',
  })
  search(
    @Query() query: FlightSearchQueryDto,
  ): Promise<FlightSearchResponseDto> {
    return this.flightSearchService.search(query);
  }
}
