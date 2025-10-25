import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

// Smart contract ABIs (simplified for key functions)
const MARKETPLACE_ABI = [
  "function listItem(address tokenContract, uint256 tokenId, uint256 price) external",
  "function purchaseIPNFT(uint256 listingId) external payable",
  "function buyItem(uint256 listingId) external payable",
  "function cancelListing(uint256 listingId) external",
  "function createAuction(address tokenContract, uint256 tokenId, uint256 startingPrice, uint256 duration) external",
  "function placeBid(uint256 auctionId) external payable",
  "function endAuction(uint256 auctionId) external",
  "function cancelAuction(uint256 auctionId) external",
  "function getListing(uint256 listingId) external view returns (tuple(uint256 listingId, address tokenContract, uint256 tokenId, address seller, uint256 price, bool active, uint256 createdAt))",
  "function getAuction(uint256 auctionId) external view returns (tuple(uint256 auctionId, address tokenContract, uint256 tokenId, address seller, uint256 startingPrice, uint256 currentBid, address currentBidder, uint256 endTime, bool active, uint256 createdAt))",
  "function getTotalListings() external view returns (uint256)",
  "function getTotalAuctions() external view returns (uint256)",
  "event ItemListed(uint256 indexed listingId, address indexed tokenContract, uint256 indexed tokenId, address seller, uint256 price)",
  "event ItemSold(uint256 indexed listingId, address indexed tokenContract, uint256 indexed tokenId, address seller, address buyer, uint256 price)",
  "event AuctionCreated(uint256 indexed auctionId, address indexed tokenContract, uint256 indexed tokenId, address seller, uint256 startingPrice, uint256 endTime)",
  "event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 bidAmount)"
];

const ESCROW_ABI = [
  "function createEscrow(address tokenContract, uint256 tokenId, address buyer, uint256 completionDays, uint8[] verificationTypes, string[] verificationDescriptions, bytes32[] expectedHashes, uint256[] verificationDeadlines) external payable",
  "function submitVerification(uint256 escrowId, uint256 requirementIndex, string evidence, bytes32 documentHash) external",
  "function approveVerification(uint256 escrowId, uint256 requirementIndex, string comment) external",
  "function completeEscrow(uint256 escrowId) external",
  "function raiseDispute(uint256 escrowId, string reason) external",
  "function resolveDispute(uint256 escrowId, address winner, string resolution) external",
  "function cancelEscrow(uint256 escrowId, string reason) external",
  "function getEscrow(uint256 escrowId) external view returns (uint256 id, address tokenContract, uint256 tokenId, address seller, address buyer, uint256 price, uint8 status, uint256 createdAt, uint256 completionDeadline)",
  "function getTotalEscrows() external view returns (uint256)",
  "event EscrowCreated(uint256 indexed escrowId, address indexed tokenContract, uint256 indexed tokenId, address seller, address buyer, uint256 price)",
  "event VerificationSubmitted(uint256 indexed escrowId, address indexed submitter, uint256 requirementIndex, string evidence)",
  "event DisputeRaised(uint256 indexed escrowId, address indexed initiator, string reason)"
];

interface ContractTransaction {
  hash: string;
  wait(): Promise<any>;
}

interface MarketplaceListing {
  listingId: number;
  tokenContract: string;
  tokenId: number;
  seller: string;
  price: string;
  active: boolean;
  createdAt: number;
}

interface MarketplaceAuction {
  auctionId: number;
  tokenContract: string;
  tokenId: number;
  seller: string;
  startingPrice: string;
  currentBid: string;
  currentBidder: string;
  endTime: number;
  active: boolean;
  createdAt: number;
}

interface EscrowDetails {
  id: number;
  tokenContract: string;
  tokenId: number;
  seller: string;
  buyer: string;
  price: string;
  status: number;
  createdAt: number;
  completionDeadline: number;
}

@Injectable()
export class SmartContractService {
  private readonly logger = new Logger(SmartContractService.name);
  private provider: ethers.JsonRpcProvider;
  private marketplaceContract: ethers.Contract;
  private escrowContract: ethers.Contract;
  private signer: ethers.Wallet;

  constructor(private configService: ConfigService) {
    this.initializeContracts();
  }

  private initializeContracts() {
    try {
      // Initialize provider (you'll need to configure this for Hedera EVM)
      const rpcUrl = this.configService.get<string>('HEDERA_RPC_URL', 'https://testnet.hashio.io/api');
      this.provider = new ethers.JsonRpcProvider(rpcUrl);

      // Initialize signer
      const privateKey = this.configService.get<string>('HEDERA_OPERATOR_KEY');
      if (!privateKey) {
        throw new Error('HEDERA_OPERATOR_KEY not configured');
      }
      this.signer = new ethers.Wallet(privateKey, this.provider);

      // Initialize contracts
      const marketplaceAddress = this.configService.get<string>('MARKETPLACE_CONTRACT_ADDRESS');
      const escrowAddress = this.configService.get<string>('ESCROW_CONTRACT_ADDRESS');

      if (marketplaceAddress) {
        this.marketplaceContract = new ethers.Contract(marketplaceAddress, MARKETPLACE_ABI, this.signer);
        this.logger.log(`Marketplace contract initialized at ${marketplaceAddress}`);
      }

      if (escrowAddress) {
        this.escrowContract = new ethers.Contract(escrowAddress, ESCROW_ABI, this.signer);
        this.logger.log(`Escrow contract initialized at ${escrowAddress}`);
      }

    } catch (error) {
      this.logger.error(`Failed to initialize contracts: ${error.message}`);
    }
  }

  // Marketplace Functions

  async listIPNFT(tokenContract: string, tokenId: number, price: string): Promise<string> {
    try {
      if (!this.marketplaceContract) {
        throw new BadRequestException('Marketplace contract not initialized');
      }

      const priceWei = ethers.parseEther(price);
      const tx: ContractTransaction = await this.marketplaceContract.listItem(tokenContract, tokenId, priceWei);
      
      this.logger.log(`Listed IP-NFT ${tokenId} for ${price} ETH. Transaction: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to list IP-NFT: ${error.message}`);
      throw new BadRequestException(`Failed to list IP-NFT: ${error.message}`);
    }
  }

  async purchaseIPNFT(listingId: number, paymentAmount: string): Promise<string> {
    try {
      if (!this.marketplaceContract) {
        throw new BadRequestException('Marketplace contract not initialized');
      }

      const paymentWei = ethers.parseEther(paymentAmount);
      const tx: ContractTransaction = await this.marketplaceContract.purchaseIPNFT(listingId, {
        value: paymentWei
      });
      
      this.logger.log(`Purchased IP-NFT listing ${listingId}. Transaction: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to purchase IP-NFT: ${error.message}`);
      throw new BadRequestException(`Failed to purchase IP-NFT: ${error.message}`);
    }
  }

  async cancelListing(listingId: number): Promise<string> {
    try {
      if (!this.marketplaceContract) {
        throw new BadRequestException('Marketplace contract not initialized');
      }

      const tx: ContractTransaction = await this.marketplaceContract.cancelListing(listingId);
      
      this.logger.log(`Cancelled listing ${listingId}. Transaction: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to cancel listing: ${error.message}`);
      throw new BadRequestException(`Failed to cancel listing: ${error.message}`);
    }
  }

  async createAuction(tokenContract: string, tokenId: number, startingPrice: string, durationHours: number): Promise<string> {
    try {
      if (!this.marketplaceContract) {
        throw new BadRequestException('Marketplace contract not initialized');
      }

      const startingPriceWei = ethers.parseEther(startingPrice);
      const durationSeconds = durationHours * 3600; // Convert hours to seconds
      
      const tx: ContractTransaction = await this.marketplaceContract.createAuction(
        tokenContract, 
        tokenId, 
        startingPriceWei, 
        durationSeconds
      );
      
      this.logger.log(`Created auction for IP-NFT ${tokenId}. Transaction: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to create auction: ${error.message}`);
      throw new BadRequestException(`Failed to create auction: ${error.message}`);
    }
  }

  async placeBid(auctionId: number, bidAmount: string): Promise<string> {
    try {
      if (!this.marketplaceContract) {
        throw new BadRequestException('Marketplace contract not initialized');
      }

      const bidWei = ethers.parseEther(bidAmount);
      const tx: ContractTransaction = await this.marketplaceContract.placeBid(auctionId, {
        value: bidWei
      });
      
      this.logger.log(`Placed bid of ${bidAmount} ETH on auction ${auctionId}. Transaction: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to place bid: ${error.message}`);
      throw new BadRequestException(`Failed to place bid: ${error.message}`);
    }
  }

  async endAuction(auctionId: number): Promise<string> {
    try {
      if (!this.marketplaceContract) {
        throw new BadRequestException('Marketplace contract not initialized');
      }

      const tx: ContractTransaction = await this.marketplaceContract.endAuction(auctionId);
      
      this.logger.log(`Ended auction ${auctionId}. Transaction: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to end auction: ${error.message}`);
      throw new BadRequestException(`Failed to end auction: ${error.message}`);
    }
  }

  async getListing(listingId: number): Promise<MarketplaceListing> {
    try {
      if (!this.marketplaceContract) {
        throw new BadRequestException('Marketplace contract not initialized');
      }

      const listing = await this.marketplaceContract.getListing(listingId);
      
      return {
        listingId: Number(listing.listingId),
        tokenContract: listing.tokenContract,
        tokenId: Number(listing.tokenId),
        seller: listing.seller,
        price: ethers.formatEther(listing.price),
        active: listing.active,
        createdAt: Number(listing.createdAt)
      };
    } catch (error) {
      this.logger.error(`Failed to get listing: ${error.message}`);
      throw new BadRequestException(`Failed to get listing: ${error.message}`);
    }
  }

  async getAuction(auctionId: number): Promise<MarketplaceAuction> {
    try {
      if (!this.marketplaceContract) {
        throw new BadRequestException('Marketplace contract not initialized');
      }

      const auction = await this.marketplaceContract.getAuction(auctionId);
      
      return {
        auctionId: Number(auction.auctionId),
        tokenContract: auction.tokenContract,
        tokenId: Number(auction.tokenId),
        seller: auction.seller,
        startingPrice: ethers.formatEther(auction.startingPrice),
        currentBid: ethers.formatEther(auction.currentBid),
        currentBidder: auction.currentBidder,
        endTime: Number(auction.endTime),
        active: auction.active,
        createdAt: Number(auction.createdAt)
      };
    } catch (error) {
      this.logger.error(`Failed to get auction: ${error.message}`);
      throw new BadRequestException(`Failed to get auction: ${error.message}`);
    }
  }

  // Escrow Functions

  async createEscrow(
    tokenContract: string,
    tokenId: number,
    buyer: string,
    completionDays: number,
    verificationTypes: number[],
    verificationDescriptions: string[],
    expectedHashes: string[],
    verificationDeadlines: number[],
    price: string
  ): Promise<string> {
    try {
      if (!this.escrowContract) {
        throw new BadRequestException('Escrow contract not initialized');
      }

      const priceWei = ethers.parseEther(price);
      const hashesBytes32 = expectedHashes.map(hash => ethers.keccak256(ethers.toUtf8Bytes(hash)));
      
      const tx: ContractTransaction = await this.escrowContract.createEscrow(
        tokenContract,
        tokenId,
        buyer,
        completionDays,
        verificationTypes,
        verificationDescriptions,
        hashesBytes32,
        verificationDeadlines,
        { value: priceWei }
      );
      
      this.logger.log(`Created escrow for IP-NFT ${tokenId}. Transaction: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to create escrow: ${error.message}`);
      throw new BadRequestException(`Failed to create escrow: ${error.message}`);
    }
  }

  async submitVerification(escrowId: number, requirementIndex: number, evidence: string, documentHash?: string): Promise<string> {
    try {
      if (!this.escrowContract) {
        throw new BadRequestException('Escrow contract not initialized');
      }

      const hashBytes32 = documentHash ? ethers.keccak256(ethers.toUtf8Bytes(documentHash)) : ethers.ZeroHash;
      
      const tx: ContractTransaction = await this.escrowContract.submitVerification(
        escrowId,
        requirementIndex,
        evidence,
        hashBytes32
      );
      
      this.logger.log(`Submitted verification for escrow ${escrowId}. Transaction: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to submit verification: ${error.message}`);
      throw new BadRequestException(`Failed to submit verification: ${error.message}`);
    }
  }

  async approveVerification(escrowId: number, requirementIndex: number, comment: string = ''): Promise<string> {
    try {
      if (!this.escrowContract) {
        throw new BadRequestException('Escrow contract not initialized');
      }

      const tx: ContractTransaction = await this.escrowContract.approveVerification(
        escrowId,
        requirementIndex,
        comment
      );
      
      this.logger.log(`Approved verification for escrow ${escrowId}. Transaction: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to approve verification: ${error.message}`);
      throw new BadRequestException(`Failed to approve verification: ${error.message}`);
    }
  }

  async completeEscrow(escrowId: number): Promise<string> {
    try {
      if (!this.escrowContract) {
        throw new BadRequestException('Escrow contract not initialized');
      }

      const tx: ContractTransaction = await this.escrowContract.completeEscrow(escrowId);
      
      this.logger.log(`Completed escrow ${escrowId}. Transaction: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to complete escrow: ${error.message}`);
      throw new BadRequestException(`Failed to complete escrow: ${error.message}`);
    }
  }

  async raiseDispute(escrowId: number, reason: string): Promise<string> {
    try {
      if (!this.escrowContract) {
        throw new BadRequestException('Escrow contract not initialized');
      }

      const tx: ContractTransaction = await this.escrowContract.raiseDispute(escrowId, reason);
      
      this.logger.log(`Raised dispute for escrow ${escrowId}. Transaction: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to raise dispute: ${error.message}`);
      throw new BadRequestException(`Failed to raise dispute: ${error.message}`);
    }
  }

  async resolveDispute(escrowId: number, winner: string, resolution: string): Promise<string> {
    try {
      if (!this.escrowContract) {
        throw new BadRequestException('Escrow contract not initialized');
      }

      const tx: ContractTransaction = await this.escrowContract.resolveDispute(escrowId, winner, resolution);
      
      this.logger.log(`Resolved dispute for escrow ${escrowId}. Transaction: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to resolve dispute: ${error.message}`);
      throw new BadRequestException(`Failed to resolve dispute: ${error.message}`);
    }
  }

  async getEscrow(escrowId: number): Promise<EscrowDetails> {
    try {
      if (!this.escrowContract) {
        throw new BadRequestException('Escrow contract not initialized');
      }

      const escrow = await this.escrowContract.getEscrow(escrowId);
      
      return {
        id: Number(escrow.id),
        tokenContract: escrow.tokenContract,
        tokenId: Number(escrow.tokenId),
        seller: escrow.seller,
        buyer: escrow.buyer,
        price: ethers.formatEther(escrow.price),
        status: Number(escrow.status),
        createdAt: Number(escrow.createdAt),
        completionDeadline: Number(escrow.completionDeadline)
      };
    } catch (error) {
      this.logger.error(`Failed to get escrow: ${error.message}`);
      throw new BadRequestException(`Failed to get escrow: ${error.message}`);
    }
  }

  // Utility Functions

  async getMarketplaceStats(): Promise<{ totalListings: number; totalAuctions: number }> {
    try {
      if (!this.marketplaceContract) {
        throw new BadRequestException('Marketplace contract not initialized');
      }

      const [totalListings, totalAuctions] = await Promise.all([
        this.marketplaceContract.getTotalListings(),
        this.marketplaceContract.getTotalAuctions()
      ]);

      return {
        totalListings: Number(totalListings),
        totalAuctions: Number(totalAuctions)
      };
    } catch (error) {
      this.logger.error(`Failed to get marketplace stats: ${error.message}`);
      throw new BadRequestException(`Failed to get marketplace stats: ${error.message}`);
    }
  }

  async getTotalEscrows(): Promise<number> {
    try {
      if (!this.escrowContract) {
        throw new BadRequestException('Escrow contract not initialized');
      }

      const total = await this.escrowContract.getTotalEscrows();
      return Number(total);
    } catch (error) {
      this.logger.error(`Failed to get total escrows: ${error.message}`);
      throw new BadRequestException(`Failed to get total escrows: ${error.message}`);
    }
  }
}
