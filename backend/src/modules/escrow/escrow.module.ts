import { Module } from '@nestjs/common';
import { HederaModule } from '../hedera/hedera.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { EscrowService } from './escrow.service';
import { EscrowController } from './escrow.controller';

@Module({
  imports: [HederaModule, SupabaseModule],
  controllers: [EscrowController],
  providers: [EscrowService],
  exports: [EscrowService],
})
export class EscrowModule {}
