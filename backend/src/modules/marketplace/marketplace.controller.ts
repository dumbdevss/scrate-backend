import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { MarketplaceService } from './marketplace.service';

@ApiTags('marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Post('list')
  @ApiOperation({ summary: 'List NFT for sale' })
  @ApiResponse({ status: 201, description: 'NFT listed successfully' })
  async listForSale(@Body() listingData: {
    tokenAddress: string;
    tokenId: string;
    price: string;
    sellerAddress: string;
  }) {
    return this.marketplaceService.listForSale(
      listingData.tokenAddress,
      listingData.tokenId,
      listingData.price,
      listingData.sellerAddress,
    );
  }

  @Post('auction')
  @ApiOperation({ summary: 'Create auction for NFT' })
  @ApiResponse({ status: 201, description: 'Auction created successfully' })
  async createAuction(@Body() auctionData: {
    tokenAddress: string;
    tokenId: string;
    startingPrice: string;
    duration: number;
    sellerAddress: string;
  }) {
    return this.marketplaceService.createAuction(
      auctionData.tokenAddress,
      auctionData.tokenId,
      auctionData.startingPrice,
      auctionData.duration,
      auctionData.sellerAddress,
    );
  }

  @Post('buy/:listingId')
  @ApiOperation({ summary: 'Buy NFT immediately' })
  @ApiParam({ name: 'listingId', description: 'Listing ID' })
  @ApiResponse({ status: 200, description: 'NFT purchased successfully' })
  async buyNow(
    @Param('listingId') listingId: string,
    @Body() buyData: {
      price: string;
      buyerAddress: string;
      tokenId: string;
    },
  ) {
    return this.marketplaceService.buyNow(
      listingId,
      buyData.price,
      buyData.buyerAddress,
      buyData.tokenId,
    );
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get marketplace transactions' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiResponse({ status: 200, description: 'Transactions retrieved successfully' })
  async getTransactions(
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ) {
    return this.marketplaceService.getMarketplaceTransactions(
      parseInt(limit),
      parseInt(offset),
    );
  }

  @Get('transactions/:tokenId')
  @ApiOperation({ summary: 'Get transactions for specific token' })
  @ApiParam({ name: 'tokenId', description: 'Token ID' })
  @ApiResponse({ status: 200, description: 'Token transactions retrieved successfully' })
  async getTransactionsByToken(@Param('tokenId') tokenId: string) {
    return this.marketplaceService.getTransactionsByToken(tokenId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get marketplace statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStats() {
    return this.marketplaceService.getMarketplaceStats();
  }
}
