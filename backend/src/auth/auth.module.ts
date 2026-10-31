import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// The User schema is registered in UsersModule; AuthService reaches it through UsersService.
// TODO: register the session schema here with MongooseModule.forFeature([...]) (NEW-07).
@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
