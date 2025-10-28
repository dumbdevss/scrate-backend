import { Controller, Post, Get, Param, HttpCode, HttpStatus, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ERC721Service } from '../services/erc721.service';
import { MintIPNFTDto } from '../dto/ipnft.dto';

@ApiTags('IP-NFT ERC721')
@Controller('api/v2/ipnft')
export class IPNFTController {
  constructor(private readonly erc721Service: ERC721Service) {}

  @Post('mint')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Mint a new IP-NFT using ERC721 contract' })
  @ApiResponse({ 
    status: 201, 
    description: 'IP-NFT minted successfully',
    schema: {
      type: 'object',
      properties: {
        tokenId: { type: 'string' },
        transactionHash: { type: 'string' },
        contractAddress: { type: 'string' },
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async mintIPNFT(@Body() mintDto: MintIPNFTDto) {
    // Create metadata object
    const metadata = {
      name: mintDto.title,
      description: mintDto.description,
      image: mintDto.image,
      external_url: mintDto.external_url,
      properties: {
        type: 'IP-NFT',
        agreements: mintDto.agreements,
        project_details: mintDto.project_details,
        ip_type: mintDto.ipType,
        tags: mintDto.tags,
        created_at: new Date().toISOString(),
      },
    };

    // Upload metadata to IPFS
    const metadataUrl = await this.erc721Service.uploadNFTMetadata(metadata);

    // Mint the NFT
    const result = await this.erc721Service.mintIPNFT(
      mintDto.to,
      mintDto.title,
      mintDto.description,
      mintDto.ipType,
      metadataUrl,
      mintDto.tags,
      mintDto.contentHash
    );

    return {
      ...result,
      message: 'IP-NFT minted successfully'
    };
  }

  @Get(':tokenId')
  @ApiOperation({ summary: 'Get information about a specific IP-NFT' })
  @ApiParam({ name: 'tokenId', description: 'Token ID of the IP-NFT' })
  @ApiResponse({ 
    status: 200, 
    description: 'IP-NFT information retrieved successfully'
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async getIPNFTInfo(@Param('tokenId') tokenId: string) {
    return this.erc721Service.getIPNFTInfo(tokenId);
  }

  @Get('collection/info')
  @ApiOperation({ summary: 'Get information about the IP-NFT collection' })
  @ApiResponse({ 
    status: 200, 
    description: 'Collection information retrieved successfully'
  })
  async getCollectionInfo() {
    const totalSupply = await this.erc721Service.getTotalSupply();
    const contractAddresses = this.erc721Service.getContractAddresses();
    
    return {
      contractAddress: contractAddresses.ipnft,
      totalSupply,
      name: 'Intellectual Property NFTs',
      symbol: 'IPNFT',
      type: 'ERC721',
    };
  }

  @Post('validate-metadata')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate IP-NFT metadata against schema' })
  @ApiResponse({ 
    status: 200, 
    description: 'Metadata validation result'
  })
  async validateMetadata(@Body() metadata: any) {
    // Basic validation - you can enhance this with JSON schema validation
    const requiredFields = ['name', 'description'];
    const isValid = requiredFields.every(field => metadata[field]);
    
    return { 
      valid: isValid,
      message: isValid ? 'Metadata is valid' : 'Metadata validation failed - missing required fields'
    };
  }
}
