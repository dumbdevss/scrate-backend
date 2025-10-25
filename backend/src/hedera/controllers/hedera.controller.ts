import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { HederaService } from '../services/hedera.service';
import { 
  MintIPNFTDto, 
  IPNFTAnalyticsDto,
  CollectionInfoDto,
  MintResultDto,
  NftInfoDto
} from '../dto/ipnft.dto';
import { CollectionInfo, MintResult, NftInfo } from '../interfaces/hedera.interface';

@ApiTags('IP-NFT Management')
@Controller('api/ipnft')
export class IPNFTController {
  constructor(private readonly hederaService: HederaService) {}

  // IP-NFT Core Management
  @Post('collection/create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create the main IP-NFT collection on Hedera' })
  @ApiResponse({ 
    status: 201, 
    description: 'IP-NFT collection created successfully',
    type: CollectionInfoDto
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createCollection(): Promise<CollectionInfo> {
    return this.hederaService.createIPNFTCollection();
  }

  @Post('mint')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Mint a new IP-NFT with comprehensive metadata' })
  @ApiResponse({ 
    status: 201, 
    description: 'IP-NFT minted successfully',
    type: MintResultDto
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
    type: CollectionInfoDto
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async getCollectionInfo(): Promise<CollectionInfo> {
    return this.hederaService.getCollectionInfo();
  }

  @Get(':serialNumber')
  @ApiOperation({ summary: 'Get information about a specific IP-NFT' })
  @ApiParam({ name: 'serialNumber', description: 'Serial number of the IP-NFT' })
  @ApiResponse({ 
    status: 200, 
    description: 'IP-NFT information retrieved successfully',
    type: NftInfoDto
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
