import { HttpStatus, NotFoundException, RequestMethod } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { Types } from 'mongoose';
import { ItinerariesController } from './itineraries.controller';
import { ItinerariesService } from './itineraries.service';
import { ItineraryBookingsService } from './itinerary-bookings.service';

// ITN-27 (bonus): unlink a booking from an itinerary day. The booking itself stays booked; only
// the link (and so its share of the budget) is removed.

const itineraryId = new Types.ObjectId('665f1c2a9b1e8a00123400a1');
const linkId = new Types.ObjectId('665f1c2a9b1e8a00123400b1');
const userId = '665f1c2a9b1e8a0012345678';
const NOT_FOUND =
  'Itinerary or linked booking not found, or they belong to another user.';

describe('ItineraryBookingsService.unlink (ITN-27)', () => {
  function makeService(deletedCount: number) {
    const deleteOne = jest.fn().mockResolvedValue({ deletedCount });
    const collection = jest.fn().mockReturnValue({ deleteOne });
    const service = new ItineraryBookingsService({
      collection,
    } as never);
    return { service, deleteOne, collection };
  }

  it('deletes only the link of this itinerary and reports it', async () => {
    const { service, deleteOne, collection } = makeService(1);

    await expect(service.unlink(itineraryId, linkId)).resolves.toBe(true);

    expect(collection).toHaveBeenCalledWith('itinerary_booking_links');
    expect(deleteOne).toHaveBeenCalledWith({ _id: linkId, itineraryId });
  });

  it('reports false when no link of this itinerary has that id', async () => {
    const { service } = makeService(0);

    await expect(service.unlink(itineraryId, linkId)).resolves.toBe(false);
  });
});

describe('ItinerariesService.unlinkBooking (ITN-27)', () => {
  function makeService(unlinked: boolean, owned = true) {
    const bookingLinks = { unlink: jest.fn().mockResolvedValue(unlinked) };
    const findOwnedOrThrow = owned
      ? jest.fn().mockResolvedValue({ _id: itineraryId })
      : jest
          .fn()
          .mockRejectedValue(new NotFoundException('Itinerary not found.'));
    const service = Object.assign(
      Object.create(ItinerariesService.prototype) as object,
      { bookingLinks, findOwnedOrThrow },
    ) as unknown as ItinerariesService;
    return { service, bookingLinks, findOwnedOrThrow };
  }

  it("removes the link of the user's own itinerary", async () => {
    const { service, bookingLinks, findOwnedOrThrow } = makeService(true);

    await expect(
      service.unlinkBooking(itineraryId, linkId, userId),
    ).resolves.toBeUndefined();

    expect(findOwnedOrThrow).toHaveBeenCalledWith(itineraryId, userId);
    expect(bookingLinks.unlink).toHaveBeenCalledWith(itineraryId, linkId);
  });

  it('answers 404 when the link is unknown or belongs to another itinerary', async () => {
    const { service } = makeService(false);

    const call = service.unlinkBooking(itineraryId, linkId, userId);
    await expect(call).rejects.toBeInstanceOf(NotFoundException);
    await expect(call).rejects.toThrow(NOT_FOUND);
  });

  it("answers 404 for another user's itinerary without touching any link", async () => {
    const { service, bookingLinks } = makeService(true, false);

    await expect(
      service.unlinkBooking(itineraryId, linkId, userId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(bookingLinks.unlink).not.toHaveBeenCalled();
  });
});

describe('ItinerariesController.unlinkBooking (ITN-27)', () => {
  const handler = Object.getOwnPropertyDescriptor(
    ItinerariesController.prototype,
    'unlinkBooking',
  )?.value as (...args: unknown[]) => Promise<void>;

  it('is DELETE itineraries/:id/bookings/:linkId and answers 204', () => {
    expect(handler).toBeDefined();
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(
      'itineraries/:id/bookings/:linkId',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.DELETE,
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(
      HttpStatus.NO_CONTENT,
    );
  });

  it('passes the itinerary, the link and the logged-in user to the service', async () => {
    const itinerariesService = {
      unlinkBooking: jest.fn().mockResolvedValue(undefined),
    };
    const controller = Object.assign(
      Object.create(ItinerariesController.prototype) as object,
      { itinerariesService },
    ) as unknown as ItinerariesController;

    await handler.call(controller, itineraryId, linkId, {
      id: userId,
      role: 'user',
    });

    expect(itinerariesService.unlinkBooking).toHaveBeenCalledWith(
      itineraryId,
      linkId,
      userId,
    );
  });
});
