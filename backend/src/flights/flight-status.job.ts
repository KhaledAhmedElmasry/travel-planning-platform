import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { Flight, FlightDocument, FlightStatus } from './schemas/flight.schema';

// Area: Airlines & Flight Inventory
// FLT-30: a flight is Scheduled, Cancelled or Departed. It becomes Departed once its departure
// time has passed. Only Scheduled flights are searchable, editable or bookable.
//
// The job below runs every minute. Between two runs a flight whose departure has just passed can
// still say "scheduled", so every check also compares departureAt with the current time (see
// isOpenFlight below, FlightsService.assertScheduled and Area 1's seat hold).

// FLT-30: whether a flight can still be searched, edited or booked: Scheduled and not departed.
// For Area 6 (flight search FLT-11, booking summary) and anywhere a flight is offered.
export function isOpenFlight(
  flight: { status: FlightStatus; departureAt: Date },
  now = new Date(),
): boolean {
  return (
    flight.status === FlightStatus.Scheduled &&
    flight.departureAt.getTime() > now.getTime()
  );
}

// FLT-30: the MongoDB filter for the same rule, e.g. flightModel.find({ ...openFlightFilter(), ... }).
export function openFlightFilter(now = new Date()) {
  return { status: FlightStatus.Scheduled, departureAt: { $gt: now } };
}

@Injectable()
export class FlightStatusJob {
  private readonly logger = new Logger(FlightStatusJob.name);

  constructor(
    @InjectModel(Flight.name)
    private readonly flightModel: Model<FlightDocument>,
  ) {}

  // FLT-30: every minute, Scheduled flights whose departure time has passed become Departed.
  // One update for all of them; Cancelled flights never change. Safe to run again or in parallel.
  // The bookings of a departed flight are completed by Area 1's job (GEN-11, NEW-01).
  @Cron(CronExpression.EVERY_MINUTE, { name: 'flight-departed-status' })
  async markDeparted(): Promise<number> {
    const now = new Date();
    const result = await this.flightModel.updateMany(
      { status: FlightStatus.Scheduled, departureAt: { $lte: now } },
      { $set: { status: FlightStatus.Departed } },
    );
    if (result.modifiedCount > 0) {
      this.logger.log(`Marked ${result.modifiedCount} flight(s) as departed.`);
    }
    return result.modifiedCount;
  }
}
