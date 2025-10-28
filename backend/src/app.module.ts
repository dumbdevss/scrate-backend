import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { HederaModule } from './modules/hedera/hedera.module';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { IpnftModule } from './modules/ipnft/ipnft.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { EscrowModule } from './modules/escrow/escrow.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
    ScheduleModule.forRoot(),
    HederaModule,
    SupabaseModule,
    IpnftModule,
    MarketplaceModule,
    EscrowModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
