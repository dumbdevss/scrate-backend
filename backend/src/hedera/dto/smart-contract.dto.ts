import { IsString, IsNumber, IsArray, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Marketplace DTOs
export class ListIPNFTDto {
  @ApiProperty({ description: 'Hedera Token ID (shard.realm.num format)' })
  @IsString()
  tokenAddress: string;

  @ApiProperty({ description: 'NFT serial number' })
  @IsNumber()
  @Min(1)
  serialNumber: number;

  @ApiProperty({ description: 'Price in HBAR (tinybars)' })
  @IsString()
  price: string;
}

export class PurchaseIPNFTDto {
  @ApiProperty({ description: 'Listing ID' })
  @IsNumber()
  @Min(1)
  listingId: number;

  @ApiProperty({ description: 'Payment amount in HBAR (tinybars)' })
  @IsString()
  paymentAmount: string;
}

export class CreateAuctionDto {
  @ApiProperty({ description: 'Hedera Token ID (shard.realm.num format)' })
  @IsString()
  tokenAddress: string;

  @ApiProperty({ description: 'NFT serial number' })
  @IsNumber()
  @Min(1)
  serialNumber: number;

  @ApiProperty({ description: 'Starting price in HBAR (tinybars)' })
  @IsString()
  startingPrice: string;

  @ApiProperty({ description: 'Duration in hours' })
  @IsNumber()
  @Min(1)
  @Max(720) // Max 30 days
  durationHours: number;
}

export class PlaceBidDto {
  @ApiProperty({ description: 'Auction ID' })
  @IsNumber()
  @Min(1)
  auctionId: number;

  @ApiProperty({ description: 'Bid amount in HBAR (tinybars)' })
  @IsString()
  bidAmount: string;
}

// Escrow DTOs
export class CreateEscrowDto {
  @ApiProperty({ description: 'Hedera Token ID (shard.realm.num format)' })
  @IsString()
  tokenAddress: string;

  @ApiProperty({ description: 'NFT serial number' })
  @IsNumber()
  @Min(1)
  serialNumber: number;

  @ApiProperty({ description: 'Buyer address (Hedera Account ID)' })
  @IsString()
  buyer: string;

  @ApiProperty({ description: 'Completion period in days' })
  @IsNumber()
  @Min(1)
  @Max(90)
  completionDays: number;

  @ApiProperty({ description: 'Verification types (0=DocumentHash, 1=PhysicalInspection, 2=ThirdPartyAudit, 3=LegalCompliance, 4=IPOwnership)', type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  verificationTypes: number[];

  @ApiProperty({ description: 'Verification descriptions', type: [String] })
  @IsArray()
  @IsString({ each: true })
  verificationDescriptions: string[];

  @ApiProperty({ description: 'Expected document hashes', type: [String] })
  @IsArray()
  @IsString({ each: true })
  expectedHashes: string[];

  @ApiProperty({ description: 'Verification deadlines in days', type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  verificationDeadlines: number[];

  @ApiProperty({ description: 'Price in HBAR (tinybars)' })
  @IsString()
  price: string;
}

export class SubmitVerificationDto {
  @ApiProperty({ description: 'Escrow ID' })
  @IsNumber()
  @Min(1)
  escrowId: number;

  @ApiProperty({ description: 'Requirement index' })
  @IsNumber()
  @Min(0)
  requirementIndex: number;

  @ApiProperty({ description: 'Evidence URL or description' })
  @IsString()
  evidence: string;

  @ApiProperty({ description: 'Document hash for verification', required: false })
  @IsOptional()
  @IsString()
  documentHash?: string;
}

export class ApproveVerificationDto {
  @ApiProperty({ description: 'Escrow ID' })
  @IsNumber()
  @Min(1)
  escrowId: number;

  @ApiProperty({ description: 'Requirement index' })
  @IsNumber()
  @Min(0)
  requirementIndex: number;

  @ApiProperty({ description: 'Approval comment', required: false })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class RaiseDisputeDto {
  @ApiProperty({ description: 'Escrow ID' })
  @IsNumber()
  @Min(1)
  escrowId: number;

  @ApiProperty({ description: 'Dispute reason' })
  @IsString()
  reason: string;
}

export class ResolveDisputeDto {
  @ApiProperty({ description: 'Escrow ID' })
  @IsNumber()
  @Min(1)
  escrowId: number;

  @ApiProperty({ description: 'Winner address (Hedera Account ID)' })
  @IsString()
  winner: string;

  @ApiProperty({ description: 'Resolution description' })
  @IsString()
  resolution: string;
}

// Response DTOs
export class TransactionResponseDto {
  @ApiProperty({ description: 'Transaction hash' })
  transactionHash: string;

  @ApiProperty({ description: 'Success message' })
  message: string;
}

export class MarketplaceListingDto {
  @ApiProperty({ description: 'Listing ID' })
  listingId: number;

  @ApiProperty({ description: 'Hedera Token ID' })
  tokenAddress: string;

  @ApiProperty({ description: 'NFT serial number' })
  serialNumber: number;

  @ApiProperty({ description: 'Seller address' })
  seller: string;

  @ApiProperty({ description: 'Price in HBAR (tinybars)' })
  price: string;

  @ApiProperty({ description: 'Is listing active' })
  active: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: number;
}

export class MarketplaceAuctionDto {
  @ApiProperty({ description: 'Auction ID' })
  auctionId: number;

  @ApiProperty({ description: 'Hedera Token ID' })
  tokenAddress: string;

  @ApiProperty({ description: 'NFT serial number' })
  serialNumber: number;

  @ApiProperty({ description: 'Seller address' })
  seller: string;

  @ApiProperty({ description: 'Starting price in HBAR (tinybars)' })
  startingPrice: string;

  @ApiProperty({ description: 'Current bid in HBAR (tinybars)' })
  currentBid: string;

  @ApiProperty({ description: 'Current bidder address' })
  currentBidder: string;

  @ApiProperty({ description: 'Auction end time' })
  endTime: number;

  @ApiProperty({ description: 'Is auction active' })
  active: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: number;
}

export class EscrowDetailsDto {
  @ApiProperty({ description: 'Escrow ID' })
  id: number;

  @ApiProperty({ description: 'Hedera Token ID' })
  tokenAddress: string;

  @ApiProperty({ description: 'NFT serial number' })
  serialNumber: number;

  @ApiProperty({ description: 'Seller address' })
  seller: string;

  @ApiProperty({ description: 'Buyer address' })
  buyer: string;

  @ApiProperty({ description: 'Price in HBAR (tinybars)' })
  price: string;

  @ApiProperty({ description: 'Escrow status (0=Active, 1=SellerVerified, 2=BuyerVerified, 3=BothVerified, 4=Completed, 5=Disputed, 6=Cancelled, 7=Refunded)' })
  status: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: number;

  @ApiProperty({ description: 'Completion deadline' })
  completionDeadline: number;
}

export class MarketplaceStatsDto {
  @ApiProperty({ description: 'Total number of listings' })
  totalListings: number;

  @ApiProperty({ description: 'Total number of auctions' })
  totalAuctions: number;
}
