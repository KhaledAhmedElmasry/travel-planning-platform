// Requirement: FLT-17.
import {
  BadRequestException,
  Controller,
  Get,
  Param,
  PipeTransform,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Types } from 'mongoose';
import { FlightDetailsResponseDto } from './dto/flight-details-response.dto';
import { FlightDetailsService } from './flight-details.service';

class FlightObjectIdPipe implements PipeTransform<string, Types.ObjectId> {
  transform(value: string): Types.ObjectId {
    if (!/^[\da-fA-F]{24}$/.test(value)) {
      throw new BadRequestException(
        'id must be a valid 24-character MongoDB ObjectId.',
      );
    }
    return new Types.ObjectId(value);
  }
}

@ApiTags('Flights')
@Controller('flights')
export class FlightDetailsController {
  constructor(private readonly flightDetailsService: FlightDetailsService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Get flight details (FLT-17)',
    description:
      'Public details include local airport times, cabin inventory, baggage allowance, policies, and bookability.',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the flight.',
    example: '665f1c2a9b1e8a0012340201',
  })
  @ApiOkResponse({ type: FlightDetailsResponseDto })
  @ApiBadRequestResponse({
    description: 'Flight id is not a valid MongoDB ObjectId.',
    schema: {
      example: {
        statusCode: 400,
        message: 'id must be a valid 24-character MongoDB ObjectId.',
        error: 'Bad Request',
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Flight not found.',
    schema: {
      example: {
        statusCode: 404,
        message: 'Flight not found.',
        error: 'Not Found',
      },
    },
  })
  getFlightDetails(
    @Param('id', new FlightObjectIdPipe()) id: Types.ObjectId,
  ): Promise<FlightDetailsResponseDto> {
    return this.flightDetailsService.getFlightDetails(id);
  }
}
