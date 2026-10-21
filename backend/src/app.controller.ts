import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Connection, ConnectionStates } from 'mongoose';

// Not a requirement: lets the team check that the server and the database connection work.
@ApiTags('Health')
@Controller('health')
export class AppController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  @ApiOperation({ summary: 'Service and database status' })
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
