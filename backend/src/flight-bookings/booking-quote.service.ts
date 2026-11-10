import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Airline } from '../airlines/schemas/airline.schema';
import { PassengerType } from '../common/enums';
import { Flight, FlightStatus, Cabin } from '../flights/schemas/flight.schema';
import { utcToLocal } from '../flights/flight-time';
import {
  calculatePassengerPricing,
  validatePassengerCounts,
} from '../flights/utils/passenger-pricing';
import { platformCurrency } from '../payments/platform-currency';
import { FlightBookingRequestDto } from './dto/hold-flight-booking.dto';
import { FlightBookingQuote } from './interfaces/flight-booking-quote.interface';

type LeanFlight = Flight & { _id: Types.ObjectId };
type LeanAirline = Airline & { _id: Types.ObjectId };
type QuoteSegmentData = {
  flight: LeanFlight;
  airline: LeanAirline;
  cabin: Cabin;
};

const FLIGHT_NOT_FOUND = 'Flight not found.';
const FLIGHT_NOT_BOOKABLE =
  'The flight is not scheduled, or not enough seats are left.';

@Injectable()
export class FlightBookingQuoteService {
  constructor(
    @InjectModel(Flight.name) private readonly flightModel: Model<Flight>,
    @InjectModel(Airline.name) private readonly airlineModel: Model<Airline>,
    private readonly config: ConfigService,
  ) {}

  async quote(request: FlightBookingRequestDto): Promise<FlightBookingQuote> {
    const adults = request.passengers.filter(
      (p) => p.type === PassengerType.Adult,
    ).length;
    const children = request.passengers.filter(
      (p) => p.type === PassengerType.Child,
    ).length;
    const infants = request.passengers.filter(
      (p) => p.type === PassengerType.Infant,
    ).length;
    const passengerCounts = validatePassengerCounts(adults, children, infants);
    const segments: QuoteSegmentData[] = [];

    for (const requestedSegment of request.segments) {
      const flight = await this.flightModel
        .findById(requestedSegment.flightId)
        .lean<LeanFlight>()
        .exec();
      if (!flight) throw new NotFoundException(FLIGHT_NOT_FOUND);
      const airline = await this.airlineModel
        .findById(flight.airlineId)
        .lean<LeanAirline>()
        .exec();
      if (!airline) throw new NotFoundException(FLIGHT_NOT_FOUND);
      if (!airline.active)
        throw new ConflictException(
          'The flight belongs to an inactive airline.',
        );
      if (
        flight.status !== FlightStatus.Scheduled ||
        flight.departureAt <= new Date()
      ) {
        throw new ConflictException(FLIGHT_NOT_BOOKABLE);
      }
      const cabin = flight.cabins.find(
        (item) => item.cabinClass === requestedSegment.cabinClass,
      );
      if (!cabin)
        throw new ConflictException(
          `The ${requestedSegment.cabinClass} cabin is not available on flight ${flight.flightNumber}.`,
        );
      if (
        cabin.total - (cabin.booked ?? 0) - (cabin.held ?? 0) <
        passengerCounts.seatsRequired
      ) {
        throw new ConflictException(FLIGHT_NOT_BOOKABLE);
      }
      segments.push({ flight, airline, cabin });
    }

    if (segments.length === 2) {
      const [outbound, returning] = segments;
      if (
        outbound.flight.departureAirport !== returning.flight.arrivalAirport ||
        outbound.flight.arrivalAirport !== returning.flight.departureAirport ||
        returning.flight.departureAt <= outbound.flight.arrivalAt
      ) {
        throw new BadRequestException(
          'The return flight must be on the reverse route after the outbound flight.',
        );
      }
    }

    const departureDate = segments[0].flight.departureDate;
    for (const passenger of request.passengers) {
      const age = ageOnDate(passenger.dateOfBirth, departureDate);
      if (!matchesPassengerType(passenger.type, age)) {
        throw new BadRequestException(
          `Passenger type ${passenger.type} does not match their age on the departure date.`,
        );
      }
      const extraBags = passenger.extraBags ?? [];
      for (const segment of segments) {
        const maxExtraBags = segment.airline.maxExtraBagsPerPassenger ?? 0;
        if (extraBags.length > maxExtraBags)
          throw new BadRequestException(
            `A passenger may have at most ${maxExtraBags} extra bag(s) on flight ${segment.flight.flightNumber}.`,
          );
        if (
          extraBags.some((bag) => bag.weightKg > segment.cabin.maxBagWeightKg)
        )
          throw new BadRequestException(
            `An extra bag exceeds the maximum weight of ${segment.cabin.maxBagWeightKg} kg on flight ${segment.flight.flightNumber}.`,
          );
        if (extraBags.length > 0 && segment.airline.extraBagPrice == null)
          throw new BadRequestException(
            `Extra baggage is not available on flight ${segment.flight.flightNumber}.`,
          );
      }
    }

    const quotedSegments = segments.map(({ flight, airline, cabin }) => ({
      flightId: flight._id.toString(),
      flightNumber: flight.flightNumber,
      airlineId: flight.airlineId.toString(),
      airlineName: airline.name,
      cabinClass: cabin.cabinClass,
      departureAirport: {
        code: flight.departureAirport,
        timeZone: flight.departureTimeZone,
      },
      arrivalAirport: {
        code: flight.arrivalAirport,
        timeZone: flight.arrivalTimeZone,
      },
      departureAt: flight.departureAt,
      arrivalAt: flight.arrivalAt,
      departureLocal: utcToLocal(flight.departureAt, flight.departureTimeZone),
      arrivalLocal: utcToLocal(flight.arrivalAt, flight.arrivalTimeZone),
      fare: cabin.price,
      freeBags: cabin.freeBags,
      maxBagWeightKg: cabin.maxBagWeightKg,
    }));

    const passengers = request.passengers.map((passenger) => {
      const extraBags = passenger.extraBags ?? [];
      const fare = segments.reduce(
        (total, segment) =>
          total +
          calculatePassengerPricing(segment.cabin.price, {
            adults: passenger.type === PassengerType.Adult ? 1 : 0,
            children: passenger.type === PassengerType.Child ? 1 : 0,
            infants: passenger.type === PassengerType.Infant ? 1 : 0,
            seatsRequired: passenger.type === PassengerType.Infant ? 0 : 1,
          }).totalPrice,
        0,
      );
      const baggageFee = segments.reduce(
        (total, segment) =>
          total + extraBags.length * (segment.airline.extraBagPrice ?? 0),
        0,
      );
      return {
        type: passenger.type,
        fullName: passenger.fullName.trim(),
        dateOfBirth: passenger.dateOfBirth,
        passportNumber: passenger.passportNumber.trim(),
        extraBags,
        fare,
        baggageFee,
      };
    });

    return {
      segments: quotedSegments,
      passengers,
      seats: passengerCounts.seatsRequired,
      totalAmount: passengers.reduce(
        (total, passenger) => total + passenger.fare + passenger.baggageFee,
        0,
      ),
      currency: platformCurrency(this.config),
    };
  }
}

export function ageOnDate(dateOfBirth: string, date: string): number {
  const [birthYear, birthMonth, birthDay] = dateOfBirth.split('-').map(Number);
  const [year, month, day] = date.split('-').map(Number);
  const hasHadBirthday =
    month > birthMonth || (month === birthMonth && day >= birthDay);
  return year - birthYear - (hasHadBirthday ? 0 : 1);
}

export function matchesPassengerType(
  type: PassengerType,
  age: number,
): boolean {
  switch (type) {
    case PassengerType.Adult:
      return age >= 12;
    case PassengerType.Child:
      return age >= 2 && age < 12;
    case PassengerType.Infant:
      return age >= 0 && age < 2;
  }
}
