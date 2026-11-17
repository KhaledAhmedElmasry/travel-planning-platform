import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';

// Not a requirement: lets the team check that the server and the database connection work.
@Controller('health')
export class AppController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  health() {
    return {
      status: 'ok',
      database:
        this.connection.readyState === ConnectionStates.connected
          ? 'connected'
          : 'disconnected',
      time: new Date().toISOString(),
    };
  }
}
