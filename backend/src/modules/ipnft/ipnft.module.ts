import { Module } from '@nestjs/common';
import { HederaModule } from '../hedera/hedera.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { IpnftService } from './ipnft.service';
import { IpnftController } from './ipnft.controller';

@Module({
  imports: [HederaModule, SupabaseModule],
  controllers: [IpnftController],
  providers: [IpnftService],
  exports: [IpnftService],
})
export class IpnftModule {}
