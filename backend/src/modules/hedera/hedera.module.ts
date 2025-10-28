import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HederaService } from './hedera.service';
import { ContractService } from './contract.service';

@Module({
  imports: [ConfigModule],
  providers: [HederaService, ContractService],
  exports: [HederaService, ContractService],
})
export class HederaModule {}
