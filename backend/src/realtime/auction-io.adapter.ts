import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';
import { corsOrigins } from '../cors.config.js';

export class AuctionIoAdapter extends IoAdapter {
  override createIOServer(port: number, options: ServerOptions): Server {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: corsOrigins() },
    }) as Server;
  }
}
