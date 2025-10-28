import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { HederaService } from './hedera.service';

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;

  // Contract addresses
  private ipnftContractAddress: string;
  private marketplaceContractAddress: string;
  private escrowContractAddress: string;

  // Contract interfaces (ABIs will be loaded)
  private ipnftContract: ethers.Contract;
  private marketplaceContract: ethers.Contract;
  private escrowContract: ethers.Contract;

  constructor(
    private configService: ConfigService,
    private hederaService: HederaService,
  ) {
    this.initializeContracts();
  }

  private async initializeContracts() {
    try {
      // Get contract addresses from config
      this.ipnftContractAddress = this.configService.get('contracts.ipnft');
      this.marketplaceContractAddress = this.configService.get('contracts.marketplace');
      this.escrowContractAddress = this.configService.get('contracts.escrow');

      // Initialize provider for Hedera network
      const network = this.configService.get('hedera.network');
      const rpcUrl = network === 'mainnet' 
        ? 'https://mainnet.hashio.io/api'
        : 'https://testnet.hashio.io/api';

      this.provider = new ethers.JsonRpcProvider(rpcUrl);

      // Create wallet from operator key
      const operatorKey = this.hederaService.getOperatorKey();
      this.wallet = new ethers.Wallet(operatorKey.toStringRaw(), this.provider);

      // Initialize contracts with ABIs
      await this.loadContractABIs();

      this.logger.log('Smart contracts initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize smart contracts', error);
      throw error;
    }
  }

  private async loadContractABIs() {
    // IPNFT Contract ABI (simplified - you should load the full ABI)
    const ipnftABI = [
      'function mint(address to, string memory title, string memory description, string memory ipType, string[] memory tags, bytes32 contentHash, bytes memory metadataBytes, string memory schemaVersion, string memory externalUrl, string memory imageUrl) public returns (uint256)',
      'function tokenURI(uint256 tokenId) public view returns (string memory)',
      'function ownerOf(uint256 tokenId) public view returns (address)',
      'function getIPMetadata(uint256 tokenId) public view returns (tuple(string title, string description, string ipType, address creator, uint256 createdAt, string[] tags, bytes32 contentHash, bool isActive, bytes metadataBytes, string schemaVersion, string externalUrl, string imageUrl))',
      'function totalSupply() public view returns (uint256)',
      'event IPNFTMinted(uint256 indexed tokenId, address indexed creator, address indexed to, string title, string ipType, string tokenURI)'
    ];

    // Marketplace Contract ABI (simplified)
    const marketplaceABI = [
      'function listForSale(address tokenAddress, uint256 tokenId, uint256 price) public returns (uint256)',
      'function createAuction(address tokenAddress, uint256 tokenId, uint256 startingPrice, uint256 duration) public returns (uint256)',
      'function buyNow(uint256 listingId) public payable',
      'function placeBid(uint256 auctionId) public payable',
      'function endAuction(uint256 auctionId) public',
      'function getListing(uint256 listingId) public view returns (tuple(uint256 listingId, address tokenAddress, uint256 tokenId, address seller, uint256 price, bool active, uint256 createdAt))',
      'function getAuction(uint256 auctionId) public view returns (tuple(uint256 auctionId, address tokenAddress, uint256 tokenId, address seller, uint256 startingPrice, uint256 currentBid, address currentBidder, uint256 endTime, bool active, uint256 createdAt))',
      'event ItemListed(uint256 indexed listingId, address indexed tokenAddress, uint256 indexed tokenId, address seller, uint256 price)',
      'event ItemSold(uint256 indexed listingId, address indexed buyer, uint256 price)',
      'event AuctionCreated(uint256 indexed auctionId, address indexed tokenAddress, uint256 indexed tokenId, address seller, uint256 startingPrice, uint256 endTime)',
      'event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount)',
      'event AuctionEnded(uint256 indexed auctionId, address indexed winner, uint256 amount)'
    ];

    // Escrow Contract ABI (simplified)
    const escrowABI = [
      'function createEscrow(address tokenAddress, uint256 tokenId, address buyer, uint256 price, uint256 deadline) public returns (uint256)',
      'function submitVerification(uint256 escrowId, uint8 verificationType, bytes32 documentHash, string memory description) public',
      'function approveVerification(uint256 escrowId, uint8 verificationType) public',
      'function completeEscrow(uint256 escrowId) public',
      'function initiateDispute(uint256 escrowId, string memory reason) public',
      'function resolveDispute(uint256 escrowId, bool favorSeller) public',
      'function getEscrowAgreement(uint256 escrowId) public view returns (tuple(uint256 escrowId, address tokenAddress, uint256 tokenId, address seller, address buyer, uint256 price, uint256 deadline, uint8 status, uint256 createdAt))',
      'event EscrowCreated(uint256 indexed escrowId, address indexed seller, address indexed buyer, address tokenAddress, uint256 tokenId, uint256 price)',
      'event VerificationSubmitted(uint256 indexed escrowId, uint8 verificationType, address submitter)',
      'event VerificationApproved(uint256 indexed escrowId, uint8 verificationType, address approver)',
      'event EscrowCompleted(uint256 indexed escrowId, address indexed seller, address indexed buyer)',
      'event DisputeInitiated(uint256 indexed escrowId, address initiator, string reason)',
      'event DisputeResolved(uint256 indexed escrowId, bool favorSeller)'
    ];

    // Initialize contract instances
    if (this.ipnftContractAddress) {
      this.ipnftContract = new ethers.Contract(this.ipnftContractAddress, ipnftABI, this.wallet);
    }

    if (this.marketplaceContractAddress) {
      this.marketplaceContract = new ethers.Contract(this.marketplaceContractAddress, marketplaceABI, this.wallet);
    }

    if (this.escrowContractAddress) {
      this.escrowContract = new ethers.Contract(this.escrowContractAddress, escrowABI, this.wallet);
    }
  }

  // IPNFT Contract Methods
  async mintIPNFT(
    to: string,
    title: string,
    description: string,
    ipType: string,
    tags: string[],
    contentHash: string,
    metadataBytes: string,
    schemaVersion: string,
    externalUrl: string,
    imageUrl: string,
  ) {
    try {
      const tx = await this.ipnftContract.mint(
        to,
        title,
        description,
        ipType,
        tags,
        contentHash,
        metadataBytes,
        schemaVersion,
        externalUrl,
        imageUrl,
      );

      const receipt = await tx.wait();
      
      // Extract token ID from events
      const mintEvent = receipt.logs.find(log => log.fragment?.name === 'IPNFTMinted');
      const tokenId = mintEvent ? mintEvent.args[0] : null;

      this.logger.log(`IPNFT minted successfully: ${tokenId}`);

      return {
        tokenId: tokenId?.toString(),
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      this.logger.error('Failed to mint IPNFT', error);
      throw error;
    }
  }

  async getIPNFTMetadata(tokenId: string) {
    try {
      const metadata = await this.ipnftContract.getIPMetadata(tokenId);
      return {
        title: metadata.title,
        description: metadata.description,
        ipType: metadata.ipType,
        creator: metadata.creator,
        createdAt: new Date(Number(metadata.createdAt) * 1000),
        tags: metadata.tags,
        contentHash: metadata.contentHash,
        isActive: metadata.isActive,
        metadataBytes: metadata.metadataBytes,
        schemaVersion: metadata.schemaVersion,
        externalUrl: metadata.externalUrl,
        imageUrl: metadata.imageUrl,
      };
    } catch (error) {
      this.logger.error('Failed to get IPNFT metadata', error);
      throw error;
    }
  }

  // Marketplace Contract Methods
  async listForSale(tokenAddress: string, tokenId: string, price: string) {
    try {
      const tx = await this.marketplaceContract.listForSale(
        tokenAddress,
        tokenId,
        ethers.parseEther(price),
      );

      const receipt = await tx.wait();
      
      // Extract listing ID from events
      const listEvent = receipt.logs.find(log => log.fragment?.name === 'ItemListed');
      const listingId = listEvent ? listEvent.args[0] : null;

      this.logger.log(`Item listed for sale: ${listingId}`);

      return {
        listingId: listingId?.toString(),
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      this.logger.error('Failed to list item for sale', error);
      throw error;
    }
  }

  async createAuction(tokenAddress: string, tokenId: string, startingPrice: string, duration: number) {
    try {
      const tx = await this.marketplaceContract.createAuction(
        tokenAddress,
        tokenId,
        ethers.parseEther(startingPrice),
        duration,
      );

      const receipt = await tx.wait();
      
      // Extract auction ID from events
      const auctionEvent = receipt.logs.find(log => log.fragment?.name === 'AuctionCreated');
      const auctionId = auctionEvent ? auctionEvent.args[0] : null;

      this.logger.log(`Auction created: ${auctionId}`);

      return {
        auctionId: auctionId?.toString(),
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      this.logger.error('Failed to create auction', error);
      throw error;
    }
  }

  async buyNow(listingId: string, price: string) {
    try {
      const tx = await this.marketplaceContract.buyNow(listingId, {
        value: ethers.parseEther(price),
      });

      const receipt = await tx.wait();

      this.logger.log(`Item purchased: ${listingId}`);

      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      this.logger.error('Failed to buy item', error);
      throw error;
    }
  }

  // Escrow Contract Methods
  async createEscrow(tokenAddress: string, tokenId: string, buyer: string, price: string, deadline: number) {
    try {
      const tx = await this.escrowContract.createEscrow(
        tokenAddress,
        tokenId,
        buyer,
        ethers.parseEther(price),
        deadline,
      );

      const receipt = await tx.wait();
      
      // Extract escrow ID from events
      const escrowEvent = receipt.logs.find(log => log.fragment?.name === 'EscrowCreated');
      const escrowId = escrowEvent ? escrowEvent.args[0] : null;

      this.logger.log(`Escrow created: ${escrowId}`);

      return {
        escrowId: escrowId?.toString(),
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      this.logger.error('Failed to create escrow', error);
      throw error;
    }
  }

  async submitVerification(escrowId: string, verificationType: number, documentHash: string, description: string) {
    try {
      const tx = await this.escrowContract.submitVerification(
        escrowId,
        verificationType,
        documentHash,
        description,
      );

      const receipt = await tx.wait();

      this.logger.log(`Verification submitted for escrow: ${escrowId}`);

      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      this.logger.error('Failed to submit verification', error);
      throw error;
    }
  }

  async completeEscrow(escrowId: string) {
    try {
      const tx = await this.escrowContract.completeEscrow(escrowId);
      const receipt = await tx.wait();

      this.logger.log(`Escrow completed: ${escrowId}`);

      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      this.logger.error('Failed to complete escrow', error);
      throw error;
    }
  }

  // Utility methods
  getIPNFTContract(): ethers.Contract {
    return this.ipnftContract;
  }

  getMarketplaceContract(): ethers.Contract {
    return this.marketplaceContract;
  }

  getEscrowContract(): ethers.Contract {
    return this.escrowContract;
  }
}
