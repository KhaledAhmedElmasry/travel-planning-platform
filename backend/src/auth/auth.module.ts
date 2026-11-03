import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UsersModule } from '../users/users.module';
import { AdminUsersController } from './admin-users.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Session, SessionSchema } from './schemas/session.schema';
import { SessionsService } from './sessions.service';

// Global so that every module can use @UseGuards(JwtAuthGuard) without importing AuthModule.
// The User schema is registered in UsersModule; AuthService reaches it through UsersService.
// The JWT secrets are passed on each sign/verify call (JWT_ACCESS_SECRET, JWT_REFRESH_SECRET).
@Global()
@Module({
  imports: [
    UsersModule,
    JwtModule.register({}),
    MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]),
  ],
  controllers: [AuthController, AdminUsersController],
  providers: [AuthService, SessionsService, JwtAuthGuard, RolesGuard],
  exports: [AuthService, SessionsService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
