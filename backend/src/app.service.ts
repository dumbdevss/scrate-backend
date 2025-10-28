import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  getHello(): string {
    return 'IP-NFT Platform API is running!';
  }

  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: this.configService.get('NODE_ENV'),
      version: '1.0.0',
      services: {
        hedera: 'connected',
        supabase: 'connected',
      },
    };
  }
}
