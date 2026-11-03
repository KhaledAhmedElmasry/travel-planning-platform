// Requirement: FLT-17.
import {
  BadRequestException,
  Controller,
  Get,
  Param,
  PipeTransform,
} from '@nestjs/common';
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

@Controller('flights')
export class FlightDetailsController {
  constructor(private readonly flightDetailsService: FlightDetailsService) {}

  @Get(':id')
  getFlightDetails(
    @Param('id', new FlightObjectIdPipe()) id: Types.ObjectId,
  ): Promise<FlightDetailsResponseDto> {
    return this.flightDetailsService.getFlightDetails(id);
  }
}
