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
  Max,
  IsEthereumAddress
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

export enum IPType {
  PATENT = 'Patent',
  TRADEMARK = 'Trademark',
  COPYRIGHT = 'Copyright',
  TRADE_SECRET = 'Trade Secret',
  DESIGN = 'Design',
  UTILITY_MODEL = 'Utility Model'
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
  @ApiProperty({ description: 'Agreement type', enum: AgreementType })
  @IsEnum(AgreementType)
  type: AgreementType;

  @ApiProperty({ description: 'Agreement document URL', required: false })
  @IsUrl()
  @IsOptional()
  document_url?: string;

  @ApiProperty({ description: 'Agreement terms summary', required: false })
  @IsString()
  @IsOptional()
  terms_summary?: string;

  @ApiProperty({ description: 'Effective date', required: false })
  @IsString()
  @IsOptional()
  effective_date?: string;

  @ApiProperty({ description: 'Expiration date', required: false })
  @IsString()
  @IsOptional()
  expiration_date?: string;
}

export class MintIPNFTDto {
  @ApiProperty({ description: 'Ethereum address to mint the NFT to' })
  @IsEthereumAddress()
  to: string;

  @ApiProperty({ description: 'Title of the intellectual property' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Description of the IP' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Type of intellectual property', enum: IPType })
  @IsEnum(IPType)
  ipType: IPType;

  @ApiProperty({ description: 'Image URL for the NFT', required: false })
  @IsUrl()
  @IsOptional()
  image?: string;

  @ApiProperty({ description: 'External URL for additional information', required: false })
  @IsUrl()
  @IsOptional()
  external_url?: string;

  @ApiProperty({ description: 'Tags for categorization', type: [String] })
  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @ApiProperty({ description: 'Content hash for verification (will be hashed to bytes32)' })
  @IsString()
  @IsNotEmpty()
  contentHash: string;

  @ApiProperty({ description: 'Project details', required: false })
  @ValidateNested()
  @Type(() => ProjectDetailsDto)
  @IsOptional()
  project_details?: ProjectDetailsDto;

  @ApiProperty({ description: 'Agreements related to this IP', type: [AgreementDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgreementDto)
  @IsOptional()
  agreements?: AgreementDto[];
}

export class IPNFTAnalyticsDto {
  @ApiProperty({ description: 'Total number of IP-NFTs minted' })
  totalMinted: number;

  @ApiProperty({ description: 'Number of active IP-NFTs' })
  activeMinted: number;

  @ApiProperty({ description: 'Number of unique creators' })
  uniqueCreators: number;

  @ApiProperty({ description: 'Most popular IP types', type: [String] })
  popularIPTypes: string[];

  @ApiProperty({ description: 'Most popular industries', type: [String] })
  popularIndustries: string[];

  @ApiProperty({ description: 'Total value locked in marketplace (ETH)' })
  totalValueLocked: string;

  @ApiProperty({ description: 'Number of active listings' })
  activeListings: number;

  @ApiProperty({ description: 'Number of active auctions' })
  activeAuctions: number;

  @ApiProperty({ description: 'Number of active escrows' })
  activeEscrows: number;
}
