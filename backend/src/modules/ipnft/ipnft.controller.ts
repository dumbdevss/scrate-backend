import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Put,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { IpnftService } from './ipnft.service';
import { CreateIPNFTDto } from './dto/create-ipnft.dto';

@ApiTags('ipnft')
@Controller('ipnft')
export class IpnftController {
  constructor(private readonly ipnftService: IpnftService) {}

  @Post('mint')
  @ApiOperation({ summary: 'Mint a new IP-NFT' })
  @ApiResponse({
    status: 201,
    description: 'IP-NFT minted successfully',
    schema: {
      example: {
        tokenId: '1',
        transactionHash: '0x123...',
        blockNumber: 12345,
        gasUsed: '150000',
        record: {
          id: 'uuid',
          token_id: '1',
          title: 'Revolutionary AI Algorithm',
          // ... other fields
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @UsePipes(new ValidationPipe({ transform: true }))
  async mintIPNFT(@Body() createIPNFTDto: CreateIPNFTDto) {
    return this.ipnftService.mintIPNFT(createIPNFTDto);
  }

  @Get(':tokenId')
  @ApiOperation({ summary: 'Get IP-NFT by token ID' })
  @ApiParam({
    name: 'tokenId',
    description: 'Token ID of the IP-NFT',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'IP-NFT details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'IP-NFT not found' })
  async getIPNFT(@Param('tokenId') tokenId: string) {
    return this.ipnftService.getIPNFT(tokenId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all IP-NFTs with pagination' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page',
    example: 50,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of items to skip',
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: 'IP-NFTs retrieved successfully',
  })
  async getAllIPNFTs(
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ) {
    return this.ipnftService.getAllIPNFTs(parseInt(limit), parseInt(offset));
  }

  @Get('creator/:address')
  @ApiOperation({ summary: 'Get IP-NFTs by creator address' })
  @ApiParam({
    name: 'address',
    description: 'Creator wallet address',
    example: '0x742d35Cc6634C0532925a3b8D6Ac6E1e9F1F1234',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page',
    example: 50,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of items to skip',
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: 'IP-NFTs by creator retrieved successfully',
  })
  async getIPNFTsByCreator(
    @Param('address') address: string,
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ) {
    return this.ipnftService.getIPNFTsByCreator(
      address,
      parseInt(limit),
      parseInt(offset),
    );
  }

  @Get('owner/:address')
  @ApiOperation({ summary: 'Get IP-NFTs by owner address' })
  @ApiParam({
    name: 'address',
    description: 'Owner wallet address',
    example: '0x742d35Cc6634C0532925a3b8D6Ac6E1e9F1F1234',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page',
    example: 50,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of items to skip',
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: 'IP-NFTs by owner retrieved successfully',
  })
  async getIPNFTsByOwner(
    @Param('address') address: string,
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ) {
    return this.ipnftService.getIPNFTsByOwner(
      address,
      parseInt(limit),
      parseInt(offset),
    );
  }

  @Get('search/:query')
  @ApiOperation({ summary: 'Search IP-NFTs by title, description, or type' })
  @ApiParam({
    name: 'query',
    description: 'Search query',
    example: 'AI algorithm',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page',
    example: 50,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of items to skip',
    example: 0,
  })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
  })
  async searchIPNFTs(
    @Param('query') query: string,
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ) {
    return this.ipnftService.searchIPNFTs(
      query,
      parseInt(limit),
      parseInt(offset),
    );
  }

  @Put(':tokenId/owner')
  @ApiOperation({ summary: 'Update IP-NFT owner (for transfer tracking)' })
  @ApiParam({
    name: 'tokenId',
    description: 'Token ID of the IP-NFT',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'IP-NFT owner updated successfully',
  })
  @ApiResponse({ status: 404, description: 'IP-NFT not found' })
  async updateIPNFTOwner(
    @Param('tokenId') tokenId: string,
    @Body('newOwnerAddress') newOwnerAddress: string,
  ) {
    return this.ipnftService.updateIPNFTOwner(tokenId, newOwnerAddress);
  }

  @Post('validate-metadata')
  @ApiOperation({ summary: 'Validate IP-NFT metadata' })
  @ApiResponse({
    status: 200,
    description: 'Metadata validation result',
    schema: {
      example: {
        valid: true,
        errors: [],
      },
    },
  })
  async validateMetadata(@Body() metadata: any) {
    const isValid = await this.ipnftService.validateMetadata(metadata);
    return {
      valid: isValid,
      metadata,
    };
  }
}
