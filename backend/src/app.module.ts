import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from './admin/admin.module';
import { AirlinesModule } from './airlines/airlines.module';
import { AppController } from './app.controller';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BlogModule } from './blog/blog.module';
import { validateEnv } from './config/env.validation';
import { ExchangeRatesModule } from './exchange-rates/exchange-rates.module';
import { FavouritesModule } from './favourites/favourites.module';
import { FlightBookingsModule } from './flight-bookings/flight-bookings.module';
import { FlightsModule } from './flights/flights.module';
import { HotelBookingsModule } from './hotel-bookings/hotel-bookings.module';
import { HotelsModule } from './hotels/hotels.module';
import { ItinerariesModule } from './itineraries/itineraries.module';
import { MailModule } from './mail/mail.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { ReferenceDataModule } from './reference-data/reference-data.module';
import { ReportsModule } from './reports/reports.module';
import { ReviewsModule } from './reviews/reviews.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
      validate: validateEnv,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
      }),
    }),

    // Scheduled jobs (@Cron), e.g. the flight hold expiry every minute (FLT-22, GEN-11).
    // Register it here only, once for the whole app.
    ScheduleModule.forRoot(),

    // TODO: register app-wide providers as they are built, for example the
    // authentication and role guards (PDF section 6.1).

    // Feature modules (one folder each, see docs/TEAM_PLAN.md for the work areas)
    ReferenceDataModule,
    AuthModule,
    UsersModule,
    AdminModule,
    AirlinesModule,
    FlightsModule,
    FlightBookingsModule,
    HotelsModule,
    HotelBookingsModule,
    ReviewsModule,
    PaymentsModule,
    ItinerariesModule,
    ExchangeRatesModule,
    BlogModule,
    ReportsModule,
    NotificationsModule,
    AuditModule,
    UploadsModule,

    // Bonus (optional) modules, PDF section 12
    FavouritesModule, // BON-02
    MailModule, // GEN-01-B, ACC-02, ACC-07
  ],
  controllers: [AppController],
})
export class AppModule {}
