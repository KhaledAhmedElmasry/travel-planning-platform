import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../common/enums';
import {
  findDuplicateThreshold,
  pickRefundTier,
  sortTiers,
} from '../common/utils';
import type { AuthUser } from '../common/interfaces';
import type {
  CancellationTier,
  RefundTier,
} from '../payments/interfaces/payable-booking.interface';
import {
  deleteLogo,
  saveLogo,
  UploadedLogo,
  validateLogo,
} from './airline-logo';
import { BaggagePolicyDto } from './dto/baggage-policy.dto';
import { CancellationPolicyDto } from './dto/cancellation-policy.dto';
import { CreateAirlineDto } from './dto/create-airline.dto';
import { UpdateAirlineDto } from './dto/update-airline.dto';
import { Airline, AirlineDocument } from './schemas/airline.schema';

// Area: Airlines & Flight Inventory
// Business logic and database access for: FLT-01, FLT-04, FLT-08, FLT-09

// The airline rules a flight booking needs (FLT-08, FLT-09): shown before payment (PAY-02) and
// used for refunds (FLT-26).
export interface AirlineBookingPolicies {
  airlineId: string;
  name: string;
  cancellationTiers: CancellationTier[];
  // Integer cents of the platform currency (FLT-08).
  extraBagPrice: number;
  maxExtraBagsPerPassenger: number;
}

// The airline's extra-baggage policy (FLT-08). extraBagPrice is null until it is set.
export interface BaggagePolicyResponse {
  extraBagPrice: number | null;
  maxExtraBagsPerPassenger: number;
}

// What the airline endpoints return (FLT-01, FLT-08).
export interface AirlineResponse {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
  active: boolean;
  baggagePolicy: BaggagePolicyResponse;
  // FLT-09: highest daysBefore first.
  cancellationTiers: CancellationTier[];
  createdAt?: Date;
  updatedAt?: Date;
}

// MongoDB error 11000: the unique index on code was broken (two requests at the same moment).
function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

const CODE_TAKEN = 'Another airline already uses this code.';

@Injectable()
export class AirlinesService {
  constructor(
    @InjectModel(Airline.name)
    private readonly airlineModel: Model<AirlineDocument>,
  ) {}

  // FLT-01: an admin creates an active airline with a name, a unique code and an optional logo.
  // The airline moderator is then created with POST /api/admin/moderators (ACC-13).
  async create(
    dto: CreateAirlineDto,
    logo?: UploadedLogo,
  ): Promise<AirlineResponse> {
    // Check the logo first, so a bad file never leaves a half-created airline.
    const logoType = logo ? validateLogo(logo) : null;

    if (await this.airlineModel.exists({ code: dto.code })) {
      throw new ConflictException(CODE_TAKEN);
    }

    const logoUrl = logo && logoType ? await saveLogo(logo, logoType) : null;
    try {
      const airline = await this.airlineModel.create({
        name: dto.name,
        code: dto.code,
        logoUrl,
        active: true,
      });
      return this.toResponse(airline);
    } catch (err) {
      await deleteLogo(logoUrl);
      if (isDuplicateKeyError(err)) throw new ConflictException(CODE_TAKEN);
      throw err;
    }
  }

  // FLT-01: the public airline profile. A deactivated airline is not shown (ACC-15).
  async findPublic(id: Types.ObjectId): Promise<AirlineResponse> {
    const airline = await this.airlineModel.findById(id).exec();
    if (!airline || !airline.active) {
      throw new NotFoundException('Airline not found.');
    }
    return this.toResponse(airline);
  }

  // FLT-01: only the moderator assigned to THIS airline edits its name, code and logo
  // (ACC-11, ACC-13). Send only the fields to change; a new logo replaces the old one (GEN-08).
  async update(
    user: AuthUser,
    id: Types.ObjectId,
    dto: UpdateAirlineDto,
    logo?: UploadedLogo,
  ): Promise<AirlineResponse> {
    const airline = await this.findManagedAirline(user, id);

    if (dto.name === undefined && dto.code === undefined && !logo) {
      throw new BadRequestException(
        'Send at least one field to change (name, code or logo).',
      );
    }

    const logoType = logo ? validateLogo(logo) : null;

    if (dto.code !== undefined && dto.code !== airline.code) {
      const taken = await this.airlineModel.exists({
        code: dto.code,
        _id: { $ne: airline._id },
      });
      if (taken) throw new ConflictException(CODE_TAKEN);
    }

    const oldLogoUrl = airline.logoUrl;
    const newLogoUrl = logo && logoType ? await saveLogo(logo, logoType) : null;

    if (dto.name !== undefined) airline.name = dto.name;
    if (dto.code !== undefined) airline.code = dto.code;
    if (newLogoUrl) airline.logoUrl = newLogoUrl;

    try {
      await airline.save();
    } catch (err) {
      await deleteLogo(newLogoUrl);
      if (isDuplicateKeyError(err)) throw new ConflictException(CODE_TAKEN);
      throw err;
    }

    // One logo per airline (GEN-08): the replaced file is removed.
    if (newLogoUrl) await deleteLogo(oldLogoUrl);
    return this.toResponse(airline);
  }

  // FLT-08: the airline's moderator sets the price per extra bag (> 0) and the maximum number of
  // extra bags per passenger (>= 0) for all its flights. New bookings use the new policy; existing
  // bookings keep the baggage fees they already agreed to (FLT-05).
  async setBaggagePolicy(
    user: AuthUser,
    id: Types.ObjectId,
    dto: BaggagePolicyDto,
  ): Promise<BaggagePolicyResponse & { airlineId: string }> {
    const airline = await this.findManagedAirline(user, id);
    airline.extraBagPrice = dto.extraBagPrice;
    airline.maxExtraBagsPerPassenger = dto.maxExtraBagsPerPassenger;
    await airline.save();
    return {
      airlineId: airline._id.toString(),
      ...this.toBaggagePolicy(airline),
    };
  }

  // FLT-09: the airline's moderator replaces all its cancellation tiers. Each daysBefore must be
  // unique; an empty list means no refunds. The tiers are saved highest daysBefore first. Existing
  // bookings use the tiers in force when they are cancelled (the refund is computed at that time).
  async setCancellationPolicy(
    user: AuthUser,
    id: Types.ObjectId,
    dto: CancellationPolicyDto,
  ): Promise<{ airlineId: string; cancellationTiers: CancellationTier[] }> {
    const airline = await this.findManagedAirline(user, id);

    const duplicate = findDuplicateThreshold(dto.tiers);
    if (duplicate !== null) {
      throw new BadRequestException(
        `The threshold daysBefore ${duplicate} is used more than once. Each tier needs a different daysBefore.`,
      );
    }

    airline.cancellationTiers = sortTiers(
      dto.tiers.map((t) => ({
        daysBefore: t.daysBefore,
        refundPercentage: t.refundPercentage,
      })),
    );
    await airline.save();
    return {
      airlineId: airline._id.toString(),
      cancellationTiers: this.toTiers(airline),
    };
  }

  // ACC-11, ACC-13: the airline that this moderator may change.
  //   404 if the airline does not exist, 403 if the user is not its moderator,
  //   403 if an admin deactivated it (ACC-15).
  // Also used by the baggage and cancellation policies (FLT-08, FLT-09) and by flights (FLT-03).
  async findManagedAirline(
    user: AuthUser,
    id: Types.ObjectId | string,
  ): Promise<AirlineDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Airline not found.');
    }
    const airline = await this.airlineModel.findById(id).exec();
    if (!airline) throw new NotFoundException('Airline not found.');

    const isItsModerator =
      user.role === Role.AirlineModerator &&
      user.airlineId !== null &&
      user.airlineId === airline._id.toString();
    if (!isItsModerator) {
      throw new ForbiddenException('Not the moderator of this airline.');
    }
    if (!airline.active) {
      throw new ForbiddenException('This airline is deactivated.');
    }
    return airline;
  }

  private toResponse(airline: AirlineDocument): AirlineResponse {
    return {
      id: airline._id.toString(),
      name: airline.name,
      code: airline.code,
      logoUrl: airline.logoUrl ?? null,
      active: airline.active,
      baggagePolicy: this.toBaggagePolicy(airline),
      cancellationTiers: this.toTiers(airline),
      createdAt: airline.createdAt,
      updatedAt: airline.updatedAt,
    };
  }

  private toBaggagePolicy(airline: AirlineDocument): BaggagePolicyResponse {
    return {
      extraBagPrice: airline.extraBagPrice ?? null,
      maxExtraBagsPerPassenger: airline.maxExtraBagsPerPassenger ?? 0,
    };
  }

  private toTiers(airline: AirlineDocument): CancellationTier[] {
    return sortTiers(airline.cancellationTiers ?? []).map((t) => ({
      daysBefore: t.daysBefore,
      refundPercentage: t.refundPercentage,
    }));
  }

  // --- Used by flight bookings (Area 1: PAY-02, FLT-26) ---

  // FLT-08, FLT-09 (for PAY-02): the airline's name, cancellation tiers (highest daysBefore
  // first), extra-bag price and maximum extra bags per passenger, or null if the airline does
  // not exist. Before the baggage policy is set, extraBagPrice is 0 and the maximum is 0.
  async getBookingPolicies(
    airlineId: string,
  ): Promise<AirlineBookingPolicies | null> {
    if (!Types.ObjectId.isValid(airlineId)) return null;
    const airline = await this.airlineModel.findById(airlineId).exec();
    if (!airline) return null;
    return {
      airlineId: airline._id.toString(),
      name: airline.name,
      cancellationTiers: this.toTiers(airline),
      extraBagPrice: airline.extraBagPrice ?? 0,
      maxExtraBagsPerPassenger: airline.maxExtraBagsPerPassenger ?? 0,
    };
  }

  // FLT-09 (for FLT-26): the tier that applies when a booking is cancelled daysBeforeDeparture
  // whole days before departure: the tier with the highest daysBefore that is not more than
  // daysBeforeDeparture; if none applies (or the airline is not found), 0% and null.
  // Example: tiers 30 -> 100%, 7 -> 50%; 10 days left -> { refundPercentage: 50, tierDaysBefore: 7 }.
  async getRefundTier(
    airlineId: string,
    daysBeforeDeparture: number,
  ): Promise<RefundTier> {
    if (!Types.ObjectId.isValid(airlineId)) {
      return { refundPercentage: 0, tierDaysBefore: null };
    }
    const airline = await this.airlineModel
      .findById(airlineId)
      .select('cancellationTiers')
      .lean()
      .exec();
    return pickRefundTier(
      airline?.cancellationTiers ?? [],
      daysBeforeDeparture,
    );
  }
}
