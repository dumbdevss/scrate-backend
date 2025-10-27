import { 
  IsString, 
  IsNotEmpty, 
  IsOptional, 
  IsUrl, 
  IsArray, 
  IsObject, 
  IsEmail, 
  IsEnum,
  ValidateNested,
  IsNumber,
  Min,
  Max
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum IndustryType {
  PHARMACEUTICAL = 'Pharmaceutical R&D',
  BIOTECHNOLOGY = 'Biotechnology',
  MEDICAL_DEVICES = 'Medical Devices',
  SOFTWARE = 'Software Technology',
  HARDWARE = 'Hardware Technology',
  CLEAN_ENERGY = 'Clean Energy',
  MATERIALS_SCIENCE = 'Materials Science',
  AI = 'Artificial Intelligence',
  BLOCKCHAIN = 'Blockchain Technology',
  OTHER = 'Other'
}

export enum AgreementType {
  LICENSE = 'License Agreement',
  PATENT_ASSIGNMENT = 'Patent Assignment',
  COPYRIGHT_TRANSFER = 'Copyright Transfer',
  TRADE_SECRET = 'Trade Secret Agreement',
  RESEARCH = 'Research Agreement',
  COLLABORATION = 'Collaboration Agreement'
}

export class ResearchLeadDto {
  @ApiProperty({ description: 'Name of the research lead' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Email of the research lead' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'ORCID ID of the research lead', required: false })
  @IsString()
  @IsOptional()
  orcid?: string;
}

export class FundingSourceDto {
  @ApiProperty({ description: 'Name of the funding source' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Grant number', required: false })
  @IsString()
  @IsOptional()
  grant_number?: string;

  @ApiProperty({ description: 'Funding amount', required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  amount?: number;
}

export class RelatedPublicationDto {
  @ApiProperty({ description: 'Title of the publication' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'DOI of the publication', required: false })
  @IsString()
  @IsOptional()
  doi?: string;

  @ApiProperty({ description: 'URL of the publication', required: false })
  @IsUrl()
  @IsOptional()
  url?: string;
}

export class ProjectDetailsDto {
  @ApiProperty({ description: 'Industry type', enum: IndustryType })
  @IsEnum(IndustryType)
  industry: IndustryType;

  @ApiProperty({ description: 'Organization name' })
  @IsString()
  @IsNotEmpty()
  organization: string;

  @ApiProperty({ description: 'Research topic' })
  @IsString()
  @IsNotEmpty()
  topic: string;

  @ApiProperty({ description: 'Research lead information', required: false })
  @ValidateNested()
  @Type(() => ResearchLeadDto)
  @IsOptional()
  research_lead?: ResearchLeadDto;

  @ApiProperty({ description: 'Funding sources', type: [FundingSourceDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FundingSourceDto)
  @IsOptional()
  funding_sources?: FundingSourceDto[];

  @ApiProperty({ description: 'Publication date', required: false })
  @IsString()
  @IsOptional()
  publication_date?: string;

  @ApiProperty({ description: 'Patent numbers', type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  patent_numbers?: string[];

  @ApiProperty({ description: 'Related publications', type: [RelatedPublicationDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RelatedPublicationDto)
  @IsOptional()
  related_publications?: RelatedPublicationDto[];
}

export class AgreementDto {
  @ApiProperty({ description: 'Type of agreement', enum: AgreementType })
  @IsEnum(AgreementType)
  type: AgreementType;

  @ApiProperty({ description: 'URL to the agreement document' })
  @IsUrl()
  url: string;

  @ApiProperty({ description: 'MIME type of the document' })
  @IsString()
  @IsNotEmpty()
  mime_type: string;

  @ApiProperty({ description: 'Content hash of the document' })
  @IsString()
  @IsNotEmpty()
  content_hash: string;

  @ApiProperty({ description: 'Encryption details', required: false })
  @IsObject()
  @IsOptional()
  encryption?: {
    protocol: string;
    encrypted_sym_key: string;
    access_control_conditions: any[];
  };
}

export class CreateIPNFTDto {
  @ApiProperty({ description: 'Name of the IP-NFT' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Description of the IP-NFT' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Image URL for the IP-NFT', required: false })
  @IsUrl()
  @IsOptional()
  image?: string;

  @ApiProperty({ description: 'External URL for more information', required: false })
  @IsUrl()
  @IsOptional()
  external_url?: string;

  @ApiProperty({ description: 'Legal agreements', type: [AgreementDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgreementDto)
  agreements: AgreementDto[];

  @ApiProperty({ description: 'Project details' })
  @ValidateNested()
  @Type(() => ProjectDetailsDto)
  project_details: ProjectDetailsDto;
}

export class MintIPNFTDto extends CreateIPNFTDto {
  @ApiProperty({ description: 'Recipient account ID' })
  @IsString()
  @IsNotEmpty()
  recipient: string;
}

export class IPNFTAnalyticsDto {
  @ApiProperty({ description: 'Total IP-NFTs minted' })
  totalMinted: number;

  @ApiProperty({ description: 'Daily transactions' })
  dailyTransactions: number;

  @ApiProperty({ description: 'Active listings' })
  activeListings: number;

  @ApiProperty({ description: 'Active auctions' })
  activeAuctions: number;

  @ApiProperty({ description: 'Active escrows' })
  activeEscrows: number;

  @ApiProperty({ description: 'Total volume in HBAR' })
  totalVolume: number;
}

export class CollectionInfoDto {
  @ApiProperty({ description: 'The ID of the token' })
  @IsString()
  tokenId: string;

  @ApiProperty({ description: 'The EVM address of the token' })
  @IsString()
  tokenAddress: string;

  @ApiProperty({ description: 'The name of the token' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'The symbol of the token' })
  @IsString()
  symbol: string;

  @ApiProperty({ description: 'The total supply of the token' })
  @IsNumber()
  totalSupply: number;

  @ApiProperty({ description: 'The maximum supply of the token', required: false })
  @IsNumber()
  @IsOptional()
  maxSupply?: number;

  @ApiProperty({ description: 'The treasury account ID for the token' })
  @IsString()
  treasuryAccountId: string;
}

export class NftInfoDto {
  @ApiProperty({ description: 'The ID of the token' })
  @IsString()
  tokenId: string;

  @ApiProperty({ description: 'The serial number of the NFT' })
  @IsNumber()
  serialNumber: number;

  @ApiProperty({ description: 'The account ID that owns the NFT' })
  @IsString()
  accountId: string;

  @ApiProperty({ description: 'The metadata of the NFT' })
  @IsString()
  metadata: string;

  @ApiProperty({ description: 'The creation timestamp of the NFT' })
  @IsString()
  createdTimestamp: string;
}

export class MintResultDto {
  @ApiProperty({ description: 'The ID of the token' })
  @IsString()
  tokenId: string;

  @ApiProperty({ description: 'The serial numbers of the minted NFTs', type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  serialNumbers: number[];

  @ApiProperty({ description: 'The ID of the minting transaction' })
  @IsString()
  transactionId: string;

  @ApiProperty({ description: 'Information about the minted NFTs', type: [NftInfoDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NftInfoDto)
  nftInfo: NftInfoDto[];
}
