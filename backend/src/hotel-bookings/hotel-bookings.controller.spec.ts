jest.mock('../common/guards/auth.guard', () => ({ JwtAuthGuard: class {} }));
import { HotelBookingsController } from './hotel-bookings.controller';

// HTL-23 (with HTL-20): the reservation details include the user's own review, or null, so the
// details page can show it with edit / delete after a reload.
describe('HotelBookingsController details', () => {
  const user = { id: '665f1c2a9b1e8a0012340001', role: 'user' };
  const bookingId = '665f1c2a9b1e8a0012340003';

  function setup(review: unknown) {
    const booking = { _id: bookingId, hotelId: { toString: () => 'h1' } };
    const service = {
      findOwned: jest.fn().mockResolvedValue(booking),
      toResponse: jest.fn(() => ({ id: bookingId, hotel: { id: 'h1' } })),
    };
    const lifecycle = {
      previewCancellation: jest.fn().mockResolvedValue({ cancellable: false }),
    };
    const refunds = { findRefundForBooking: jest.fn().mockResolvedValue(null) };
    const hotels = { getBookingPolicies: jest.fn().mockResolvedValue(null) };
    const payments = {
      findPaymentForBooking: jest.fn().mockResolvedValue(null),
    };
    const reviews = { findForReservation: jest.fn().mockResolvedValue(review) };
    const controller = new HotelBookingsController(
      service as never,
      lifecycle as never,
      refunds as never,
      hotels as never,
      payments as never,
      reviews as never,
    );
    return { controller, service, reviews };
  }

  it("returns the user's review of the reservation", async () => {
    const review = { id: 'r1', rating: 5, hidden: false };
    const { controller, reviews } = setup(review);

    const result = await controller.details(user as never, bookingId);

    expect(reviews.findForReservation).toHaveBeenCalledWith(bookingId, user.id);
    expect(result.review).toBe(review);
  });

  it('returns review null when the reservation has none', async () => {
    const { controller } = setup(null);

    const result = await controller.details(user as never, bookingId);

    expect(result.review).toBeNull();
  });

  it('checks ownership before reading the review (another user gets 404 first)', async () => {
    const { controller, service, reviews } = setup(null);
    service.findOwned.mockRejectedValue(new Error('not found'));

    await expect(controller.details(user as never, bookingId)).rejects.toThrow(
      'not found',
    );
    expect(reviews.findForReservation).not.toHaveBeenCalled();
  });
});
