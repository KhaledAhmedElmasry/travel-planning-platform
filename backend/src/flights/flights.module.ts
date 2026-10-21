import { Module } from '@nestjs/common';
import { FlightSearchController } from './flight-search.controller';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';

// TODO: register this module's schemas here with MongooseModule.forFeature([...]).
@Module({
  controllers: [FlightSearchController, FlightsController],
  providers: [FlightsService],
  exports: [FlightsService],
})
export class FlightsModule {}
