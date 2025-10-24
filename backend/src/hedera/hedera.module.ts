import { Module } from '@nestjs/common';
import { HederaService } from './services/hedera.service';
import { HederaController } from './controllers/hedera.controller';

@Module({
  controllers: [HederaController],
  providers: [HederaService],
  exports: [HederaService],
})
export class HederaModule {} 
