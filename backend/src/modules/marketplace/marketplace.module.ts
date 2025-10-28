import { Module } from '@nestjs/common';
import { HederaModule } from '../hedera/hedera.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceController } from './marketplace.controller';

@Module({
  imports: [HederaModule, SupabaseModule],
  controllers: [MarketplaceController],
  providers: [MarketplaceService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
