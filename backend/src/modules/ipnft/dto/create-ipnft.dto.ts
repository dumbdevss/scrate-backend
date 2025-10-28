import { IsString, IsArray, IsOptional, IsUrl, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateIPNFTDto {
  @ApiProperty({
    description: 'Title of the IP-NFT',
    example: 'Revolutionary AI Algorithm',
    maxLength: 200,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'Description of the intellectual property',
    example: 'A breakthrough machine learning algorithm for natural language processing',
    maxLength: 1000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  description: string;

  @ApiProperty({
    description: 'Type of intellectual property',
    example: 'Patent',
    enum: ['Patent', 'Trademark', 'Copyright', 'Trade Secret', 'Research', 'Software'],
  })
  @IsString()
  ipType: string;

  @ApiProperty({
    description: 'Tags associated with the IP-NFT',
    example: ['AI', 'Machine Learning', 'NLP', 'Algorithm'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @ApiProperty({
    description: 'Hash of the IP content for verification',
    example: 'bafkreicrhuxfzrydht6tmd4kyy6pkbhspqthswg6xbiqlaztmf774ojxhq',
  })
  @IsString()
  contentHash: string;

  @ApiProperty({
    description: 'Metadata bytes (usually IPFS hash or JSON)',
    example: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
  })
  @IsString()
  metadataBytes: string;

  @ApiProperty({
    description: 'Schema version for metadata compatibility',
    example: '1.0.0',
    default: '1.0.0',
  })
  @IsString()
  @IsOptional()
  schemaVersion?: string = '1.0.0';

  @ApiProperty({
    description: 'External URL for additional information',
    example: 'https://example.com/ip-details',
    required: false,
  })
  @IsUrl()
  @IsOptional()
  externalUrl?: string;

  @ApiProperty({
    description: 'Image URL for the NFT',
    example: 'https://example.com/image.png',
    required: false,
  })
  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({
    description: 'Address to mint the NFT to',
    example: '0x742d35Cc6634C0532925a3b8D6Ac6E1e9F1F1234',
  })
  @IsString()
  toAddress: string;
}
