import { Controller, Post, Get, Param, HttpCode, HttpStatus, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { HederaService } from '../services/hedera.service';
import { 
  MintIPNFTDto, 
  IPNFTAnalyticsDto
} from '../dto/ipnft.dto';
import { CollectionInfo, MintResult, NftInfo } from '../interfaces/hedera.interface';

@ApiTags('IP-NFT System')
@Controller('api/ipnft')
export class HederaController {
  constructor(private readonly hederaService: HederaService) {}

  @Post('collection/create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create the main IP-NFT collection on Hedera' })
  @ApiResponse({ 
    status: 201, 
    description: 'IP-NFT collection created successfully',
    type: Object
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createIPNFTCollection(): Promise<CollectionInfo> {
    return this.hederaService.createIPNFTCollection();
  }

  @Post('mint')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Mint a new IP-NFT with comprehensive metadata' })
  @ApiResponse({ 
    status: 201, 
    description: 'IP-NFT minted successfully',
    type: Object
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async mintIPNFT(@Body() mintDto: MintIPNFTDto): Promise<MintResult> {
    return this.hederaService.mintIPNFT(mintDto);
  }

  @Get('collection/info')
  @ApiOperation({ summary: 'Get information about the IP-NFT collection' })
  @ApiResponse({ 
    status: 200, 
    description: 'Collection information retrieved successfully',
    type: Object
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async getCollectionInfo(): Promise<CollectionInfo> {
    return this.hederaService.getCollectionInfo();
  }

  @Get('nft/:serialNumber')
  @ApiOperation({ summary: 'Get information about a specific IP-NFT' })
  @ApiParam({ name: 'serialNumber', description: 'Serial number of the IP-NFT' })
  @ApiResponse({ 
    status: 200, 
    description: 'IP-NFT information retrieved successfully',
    type: Object
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async getIPNFTInfo(@Param('serialNumber') serialNumber: string): Promise<NftInfo> {
    return this.hederaService.getIPNFTInfo(parseInt(serialNumber));
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get platform analytics and metrics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Analytics retrieved successfully',
    type: IPNFTAnalyticsDto
  })
  async getAnalytics(): Promise<IPNFTAnalyticsDto> {
    return this.hederaService.getAnalytics();
  }

  @Post('validate-metadata')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate IP-NFT metadata against schema' })
  @ApiResponse({ 
    status: 200, 
    description: 'Metadata validation result'
  })
  async validateMetadata(@Body() metadata: any) {
    const isValid = await this.hederaService.validateMetadata(metadata);
    return { 
      valid: isValid,
      message: isValid ? 'Metadata is valid' : 'Metadata validation failed'
    };
  }
}
