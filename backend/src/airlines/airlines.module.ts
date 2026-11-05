import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AirlinesController } from './airlines.controller';
import { AirlinesService } from './airlines.service';
import { Airline, AirlineSchema } from './schemas/airline.schema';

// Area: Airlines & Flight Inventory
// AirlinesService is exported for flights (FLT-03) and flight bookings (PAY-02, FLT-26).
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Airline.name, schema: AirlineSchema }]),
  ],
  controllers: [AirlinesController],
  providers: [AirlinesService],
  exports: [AirlinesService],
})
export class AirlinesModule {}
