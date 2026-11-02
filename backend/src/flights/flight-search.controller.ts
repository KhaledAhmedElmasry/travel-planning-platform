// Requirements: FLT-11, FLT-12, GEN-02, GEN-04, GEN-05, GEN-13.
import {
  BadRequestException,
  Controller,
  Get,
  PipeTransform,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { FlightSearchQueryDto } from './dto/flight-search-query.dto';
import {
  FlightSearchResponseDto,
  RoundTripFlightSearchResponseDto,
} from './dto/flight-search-response.dto';
import { FlightSearchService } from './flight-search.service';
import { FlightSortBy, FlightSortOrder } from './utils/flight-sorting';

class FlightSearchOpenApiAliasesPipe implements PipeTransform {
  transform(value: unknown): unknown {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return value;
    }

    const normalized = { ...(value as Record<string, unknown>) };
    const aliases = [
      ['origin', 'from'],
      ['destination', 'to'],
      ['departureDate', 'date'],
      ['cabinClass', 'cabin'],
    ] as const;
    for (const [openApiName, internalName] of aliases) {
      if (normalized[internalName] === undefined) {
        normalized[internalName] = normalized[openApiName];
      }
      delete normalized[openApiName];
    }
    return normalized;
  }
}

@ApiTags('Flights')
@Controller('flights')
export class FlightSearchController {
  constructor(private readonly flightSearchService: FlightSearchService) {}

  @Get('search')
  @UsePipes(
    new FlightSearchOpenApiAliasesPipe(),
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
    summary: 'Search scheduled flights (FLT-11, FLT-12, FLT-15)',
    description:
      'Public one-way or round-trip search with optional inclusive price bounds and sorting. Return date is local to the original arrival airport. A returnDate on a one-way search is rejected.',
  })
  @ApiQuery({ name: 'from', required: true, type: String, example: 'CAI' })
  @ApiQuery({ name: 'to', required: true, type: String, example: 'DXB' })
  @ApiQuery({
    name: 'date',
    required: true,
    type: String,
    example: '2026-11-02',
  })
  @ApiQuery({
    name: 'tripType',
    required: false,
    enum: ['one-way', 'round-trip'],
    example: 'one-way',
  })
  @ApiQuery({
    name: 'returnDate',
    required: false,
    type: String,
    example: '2026-11-03',
  })
  @ApiQuery({
    name: 'adults',
    required: false,
    type: Number,
    example: 1,
    description: 'At least one adult is required.',
  })
  @ApiQuery({
    name: 'children',
    required: false,
    type: Number,
    example: 0,
    description: 'Passengers aged 2 to 11; defaults to 0.',
  })
  @ApiQuery({
    name: 'infants',
    required: false,
    type: Number,
    example: 0,
    description: 'Passengers under 2; defaults to 0 and cannot exceed adults.',
  })
  @ApiQuery({
    name: 'passengers',
    required: false,
    type: Number,
    example: 2,
    deprecated: true,
    description: 'Legacy FLT-11 alias for adults when adults is absent.',
  })
  @ApiQuery({
    name: 'cabin',
    required: false,
    enum: ['Economy', 'Premium Economy', 'Business', 'First'],
    example: 'Economy',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({
    name: 'returnPage',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'minPrice',
    required: false,
    type: Number,
    minimum: 0,
    example: 10000,
  })
  @ApiQuery({
    name: 'maxPrice',
    required: false,
    type: Number,
    minimum: 0,
    example: 50000,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: [
      FlightSortBy.Price,
      FlightSortBy.Duration,
      FlightSortBy.DepartureTime,
    ],
    default: FlightSortBy.DepartureTime,
    example: FlightSortBy.Price,
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: [FlightSortOrder.Ascending, FlightSortOrder.Descending],
    default: FlightSortOrder.Ascending,
    example: FlightSortOrder.Ascending,
  })
  @ApiExtraModels(FlightSearchResponseDto, RoundTripFlightSearchResponseDto)
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(FlightSearchResponseDto) },
        { $ref: getSchemaPath(RoundTripFlightSearchResponseDto) },
      ],
    },
  })
  @ApiBadRequestResponse({
    description:
      'The query is invalid, an airport code is unknown, or minPrice is greater than maxPrice.',
    schema: {
      example: {
        statusCode: 400,
        message: 'minPrice must not be greater than maxPrice.',
        error: 'Bad Request',
      },
    },
  })
  search(
    @Query() query: FlightSearchQueryDto,
  ): Promise<FlightSearchResponseDto | RoundTripFlightSearchResponseDto> {
    return this.flightSearchService.search(query);
  }
}
