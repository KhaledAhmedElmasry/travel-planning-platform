// Requirements: FLT-11, FLT-12, GEN-02, GEN-04, GEN-05, GEN-13.
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
    summary: 'Search scheduled flights (FLT-11, FLT-12)',
    description:
      'Public one-way or round-trip search. Return date is local to the original arrival airport. A returnDate on a one-way search is rejected.',
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
    description: 'The query is invalid or an airport code is unknown.',
  })
  search(
    @Query() query: FlightSearchQueryDto,
  ): Promise<FlightSearchResponseDto | RoundTripFlightSearchResponseDto> {
    return this.flightSearchService.search(query);
  }
}
