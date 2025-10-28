import { Module } from '@nestjs/common';
import { IPNFTController } from './controllers/ipnft.controller';
import { MarketplaceController } from './controllers/marketplace.controller';
import { EscrowController } from './controllers/escrow.controller';
import { ERC721Service } from './services/erc721.service';

@Module({
  controllers: [IPNFTController, MarketplaceController, EscrowController],
  providers: [ERC721Service],
  exports: [ERC721Service],
})
export class ERC721Module {}
