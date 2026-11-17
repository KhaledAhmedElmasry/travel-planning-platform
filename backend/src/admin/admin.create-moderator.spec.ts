import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { Role } from '../common/enums';
import { AdminService } from './admin.service';

// ACC-13 + PAY-04: a moderator created by the admin gets the platform currency as preferred
// currency (like a registered user, ACC-01), not a fixed 'USD'.

describe('AdminService.createModerator (ACC-13)', () => {
  it('sets the preferred currency to PLATFORM_CURRENCY', async () => {
    const saved: Record<string, unknown>[] = [];
    function UserModel(this: Record<string, unknown>, data: object) {
      Object.assign(this, data, { _id: new Types.ObjectId() });
      this.save = () => {
        saved.push(this);
        return Promise.resolve(this);
      };
    }
    UserModel.findOne = () => ({ exec: () => Promise.resolve(null) });
    const airlines = {
      findOne: () => Promise.resolve({ name: 'Nile Air' }),
    };
    const service = new AdminService(
      UserModel as never,
      { db: { collection: () => airlines } } as never,
      undefined as never,
      undefined as never,
      { record: () => Promise.resolve() } as never,
      undefined as never,
      undefined as never,
      { sendModeratorInvitation: () => Promise.resolve() } as never,
      {
        get: (key: string) => (key === 'PLATFORM_CURRENCY' ? 'EUR' : undefined),
      } as unknown as ConfigService,
    );

    await service.createModerator(
      { id: new Types.ObjectId().toString() } as never,
      {
        name: 'Air Mod',
        email: 'air.mod@example.com',
        role: Role.AirlineModerator,
        providerId: new Types.ObjectId().toString(),
        temporaryPassword: 'Temp0rary!x',
      } as never,
    );

    expect(saved).toHaveLength(1);
    expect(saved[0].preferredCurrency).toBe('EUR');
  });
});
