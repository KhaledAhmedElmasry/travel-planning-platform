import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';

// Owner: Member 2 (Auth & Accounts)
// Requirements: ACC-09, ACC-11, ACC-12
// Endpoints to implement (PDF section 8):
//   GET    /api/users/me   ACC-11
//   PATCH  /api/users/me   ACC-09
//   DELETE /api/users/me   ACC-12
@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // TODO: add the endpoints listed above.
}
