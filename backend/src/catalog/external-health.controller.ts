import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ExternalItemProvider } from './external-item.provider.js';

@Controller('health/external')
export class ExternalHealthController {
  constructor(private readonly provider: ExternalItemProvider) {}

  @Get()
  async check() {
    try {
      const result = await this.provider.check();
      if (result === 'mocked')
        return { status: 'mocked', services: { cleveland: 'not_checked' } };
      return { status: 'ok', services: { cleveland: 'up' } };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        services: { cleveland: 'down' },
      });
    }
  }
}
