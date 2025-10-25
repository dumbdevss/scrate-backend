import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { SmartContractService } from '../services/smart-contract.service';
import {
  ListIPNFTDto,
  PurchaseIPNFTDto,
  CreateAuctionDto,
  PlaceBidDto,
  TransactionResponseDto,
  MarketplaceListingDto,
  MarketplaceAuctionDto,
  MarketplaceStatsDto
} from '../dto/smart-contract.dto';

@ApiTags('Marketplace')
@Controller('api/marketplace')
export class MarketplaceController {
  constructor(private readonly smartContractService: SmartContractService) {}

  // Listing Management
  @Post('list')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'List an IP-NFT for sale on the marketplace' })
  @ApiResponse({ 
    status: 201, 
    description: 'IP-NFT listed successfully',
    type: TransactionResponseDto
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async listIPNFT(@Body() listDto: ListIPNFTDto): Promise<TransactionResponseDto> {
    const txHash = await this.smartContractService.listIPNFT(
      listDto.tokenContract,
      listDto.tokenId,
      listDto.price
    );
    return {
      transactionHash: txHash,
      message: 'IP-NFT listed successfully'
    };
  }

  @Post('purchase')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Purchase an IP-NFT from the marketplace' })
  @ApiResponse({ 
    status: 200, 
    description: 'IP-NFT purchased successfully',
    type: TransactionResponseDto
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async purchaseIPNFT(@Body() purchaseDto: PurchaseIPNFTDto): Promise<TransactionResponseDto> {
    const txHash = await this.smartContractService.purchaseIPNFT(
      purchaseDto.listingId,
      purchaseDto.paymentAmount
    );
    return {
      transactionHash: txHash,
      message: 'IP-NFT purchased successfully'
    };
  }

  @Post('listing/:listingId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a marketplace listing' })
  @ApiParam({ name: 'listingId', description: 'Listing ID to cancel' })
  @ApiResponse({ 
    status: 200, 
    description: 'Listing cancelled successfully',
    type: TransactionResponseDto
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async cancelListing(@Param('listingId') listingId: string): Promise<TransactionResponseDto> {
    const txHash = await this.smartContractService.cancelListing(parseInt(listingId));
    return {
      transactionHash: txHash,
      message: 'Listing cancelled successfully'
    };
  }

  @Get('listing/:listingId')
  @ApiOperation({ summary: 'Get marketplace listing details' })
  @ApiParam({ name: 'listingId', description: 'Listing ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Listing details retrieved successfully',
    type: MarketplaceListingDto
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async getListing(@Param('listingId') listingId: string): Promise<MarketplaceListingDto> {
    return this.smartContractService.getListing(parseInt(listingId));
  }

  // Auction Management
  @Post('auction/create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an auction for an IP-NFT' })
  @ApiResponse({ 
    status: 201, 
    description: 'Auction created successfully',
    type: TransactionResponseDto
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createAuction(@Body() auctionDto: CreateAuctionDto): Promise<TransactionResponseDto> {
    const txHash = await this.smartContractService.createAuction(
      auctionDto.tokenContract,
      auctionDto.tokenId,
      auctionDto.startingPrice,
      auctionDto.durationHours
    );
    return {
      transactionHash: txHash,
      message: 'Auction created successfully'
    };
  }

  @Post('auction/bid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Place a bid on an auction' })
  @ApiResponse({ 
    status: 200, 
    description: 'Bid placed successfully',
    type: TransactionResponseDto
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async placeBid(@Body() bidDto: PlaceBidDto): Promise<TransactionResponseDto> {
    const txHash = await this.smartContractService.placeBid(
      bidDto.auctionId,
      bidDto.bidAmount
    );
    return {
      transactionHash: txHash,
      message: 'Bid placed successfully'
    };
  }

  @Post('auction/:auctionId/end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End an auction' })
  @ApiParam({ name: 'auctionId', description: 'Auction ID to end' })
  @ApiResponse({ 
    status: 200, 
    description: 'Auction ended successfully',
    type: TransactionResponseDto
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async endAuction(@Param('auctionId') auctionId: string): Promise<TransactionResponseDto> {
    const txHash = await this.smartContractService.endAuction(parseInt(auctionId));
    return {
      transactionHash: txHash,
      message: 'Auction ended successfully'
    };
  }

  @Get('auction/:auctionId')
  @ApiOperation({ summary: 'Get auction details' })
  @ApiParam({ name: 'auctionId', description: 'Auction ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Auction details retrieved successfully',
    type: MarketplaceAuctionDto
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async getAuction(@Param('auctionId') auctionId: string): Promise<MarketplaceAuctionDto> {
    return this.smartContractService.getAuction(parseInt(auctionId));
  }

  // Statistics
  @Get('stats')
  @ApiOperation({ summary: 'Get marketplace statistics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Marketplace stats retrieved successfully',
    type: MarketplaceStatsDto
  })
  async getMarketplaceStats(): Promise<MarketplaceStatsDto> {
    return this.smartContractService.getMarketplaceStats();
  }
}
