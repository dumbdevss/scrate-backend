import { Module } from '@nestjs/common';
import { HederaController } from './controllers/hedera.controller';
import { MarketplaceController } from './controllers/marketplace.controller';
import { EscrowController } from './controllers/escrow.controller';
import { HederaService } from './services/hedera.service';
import { SmartContractService } from './services/smart-contract.service';

@Module({
  controllers: [HederaController, MarketplaceController, EscrowController],
  providers: [HederaService, SmartContractService],
  exports: [HederaService, SmartContractService],
})
export class HederaModule {}
