import { Controller, Post, Get, Param, HttpCode, HttpStatus, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { HederaService, ERC721MintResult } from '../services/hedera.service';
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

  // ERC721 Endpoints
  @Post('erc721/mint')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Mint a new IP-NFT using ERC721 contract' })
  @ApiResponse({ 
    status: 201, 
    description: 'ERC721 IP-NFT minted successfully',
    schema: {
      type: 'object',
      properties: {
        tokenId: { type: 'string' },
        transactionHash: { type: 'string' },
        contractAddress: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async mintIPNFTERC721(@Body() mintDto: MintIPNFTDto): Promise<ERC721MintResult> {
    // Create metadata object and upload to IPFS
    const metadata = {
      name: mintDto.name,
      description: mintDto.description,
      image: mintDto.image,
      external_url: mintDto.external_url,
      properties: {
        type: 'IP-NFT',
        agreements: mintDto.agreements,
        project_details: mintDto.project_details,
      },
    };

    const metadataUrl = await this.hederaService.uploadNFTMetadata(metadata);

    return this.hederaService.mintIPNFTERC721(
      mintDto.recipient,
      mintDto.name,
      mintDto.description,
      mintDto.project_details.industry, // Using industry as ipType
      metadataUrl,
      [mintDto.project_details.industry, mintDto.project_details.topic], // Simple tags
      mintDto.name + mintDto.description // Simple content hash
    );
  }

  @Get('erc721/:tokenId')
  @ApiOperation({ summary: 'Get information about a specific ERC721 IP-NFT' })
  @ApiParam({ name: 'tokenId', description: 'Token ID of the ERC721 IP-NFT' })
  @ApiResponse({ 
    status: 200, 
    description: 'ERC721 IP-NFT information retrieved successfully'
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async getERC721IPNFTInfo(@Param('tokenId') tokenId: string) {
    return this.hederaService.getERC721IPNFTInfo(tokenId);
  }

  @Get('erc721/collection/info')
  @ApiOperation({ summary: 'Get information about the ERC721 IP-NFT collection' })
  @ApiResponse({ 
    status: 200, 
    description: 'ERC721 collection information retrieved successfully'
  })
  async getERC721CollectionInfo() {
    const totalSupply = await this.hederaService.getERC721TotalSupply();
    const contractAddresses = this.hederaService.getContractAddresses();
    
    return {
      contractAddress: contractAddresses.ipnft,
      totalSupply,
      name: 'Intellectual Property NFTs',
      symbol: 'IPNFT',
      type: 'ERC721',
    };
  }
}
