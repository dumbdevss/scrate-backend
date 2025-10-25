import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  AccountId,
  PrivateKey,
  ContractExecuteTransaction,
  ContractCallQuery,
  ContractId,
  Hbar,
  TransactionResponse,
  ContractFunctionParameters,
  TransactionReceipt,
  Status
} from '@hashgraph/sdk';

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
  private client: Client;
  private operatorId: AccountId;
  private operatorKey: PrivateKey;
  private marketplaceContractId: ContractId;
  private escrowContractId: ContractId;

  constructor(private configService: ConfigService) {
    this.initializeClient();
  }

  private initializeClient() {
    try {
      // Initialize Hedera client
      const operatorIdStr = this.configService.get<string>('HEDERA_OPERATOR_ID');
      const operatorKeyStr = this.configService.get<string>('HEDERA_OPERATOR_KEY');
      const network = this.configService.get<string>('HEDERA_NETWORK', 'testnet');

      if (!operatorIdStr || !operatorKeyStr) {
        throw new Error('HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be configured');
      }

      this.operatorId = AccountId.fromString(operatorIdStr);
      this.operatorKey = PrivateKey.fromStringECDSA(operatorKeyStr);

      // Initialize client based on network
      switch (network) {
        case 'mainnet':
          this.client = Client.forMainnet();
          break;
        case 'previewnet':
          this.client = Client.forPreviewnet();
          break;
        default:
          this.client = Client.forTestnet();
      }

      this.client.setOperator(this.operatorId, this.operatorKey);

      // Initialize contract IDs
      const marketplaceAddress = this.configService.get<string>('MARKETPLACE_CONTRACT_ADDRESS');
      const escrowAddress = this.configService.get<string>('ESCROW_CONTRACT_ADDRESS');

      if (marketplaceAddress) {
        try {
          // Check if it's a Solidity address (starts with 0x)
          if (marketplaceAddress.startsWith('0x')) {
            this.marketplaceContractId = ContractId.fromSolidityAddress(marketplaceAddress);
          } else {
            this.marketplaceContractId = ContractId.fromString(marketplaceAddress);
          }
          this.logger.log(`Marketplace contract initialized at ${marketplaceAddress}`);
        } catch (error) {
          this.logger.error(`Failed to parse marketplace contract address: ${error.message}`);
          throw error;
        }
      }

      if (escrowAddress) {
        try {
          // Check if it's a Solidity address (starts with 0x)
          if (escrowAddress.startsWith('0x')) {
            this.escrowContractId = ContractId.fromSolidityAddress(escrowAddress);
          } else {
            this.escrowContractId = ContractId.fromString(escrowAddress);
          }
          this.logger.log(`Escrow contract initialized at ${escrowAddress}`);
        } catch (error) {
          this.logger.error(`Failed to parse escrow contract address: ${error.message}`);
          throw error;
        }
      }

      this.logger.log(`Hedera client initialized for ${network}`);
    } catch (error) {
      this.logger.error(`Failed to initialize Hedera client: ${error.message}`);
    }
  }

  // Marketplace Functions

  async listIPNFT(tokenContract: string, tokenId: number, price: string): Promise<string> {
    try {
      if (!this.marketplaceContractId) {
        throw new BadRequestException('Marketplace contract not initialized');
      }

      const priceHbar = Hbar.fromTinybars(parseInt(price));
      
      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(this.marketplaceContractId)
        .setGas(300000)
        .setFunction(
          'listItem',
          new ContractFunctionParameters()
            .addAddress(tokenContract)
            .addUint256(tokenId)
            .addUint256(priceHbar.toTinybars())
        );

      const txResponse: TransactionResponse = await contractExecuteTx.execute(this.client);
      const receipt: TransactionReceipt = await txResponse.getReceipt(this.client);
      
      if (receipt.status !== Status.Success) {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      this.logger.log(`Listed IP-NFT ${tokenId} for ${price} HBAR. Transaction: ${txResponse.transactionId}`);
      return txResponse.transactionId.toString();
    } catch (error) {
      this.logger.error(`Failed to list IP-NFT: ${error.message}`);
      throw new BadRequestException(`Failed to list IP-NFT: ${error.message}`);
    }
  }

  async purchaseIPNFT(listingId: number, paymentAmount: string): Promise<string> {
    try {
      if (!this.marketplaceContractId) {
        throw new BadRequestException('Marketplace contract not initialized');
      }

      const paymentHbar = Hbar.fromTinybars(parseInt(paymentAmount));
      
      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(this.marketplaceContractId)
        .setGas(300000)
        .setPayableAmount(paymentHbar)
        .setFunction(
          'purchaseIPNFT',
          new ContractFunctionParameters()
            .addUint256(listingId)
        );

      const txResponse: TransactionResponse = await contractExecuteTx.execute(this.client);
      const receipt: TransactionReceipt = await txResponse.getReceipt(this.client);
      
      if (receipt.status !== Status.Success) {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      this.logger.log(`Purchased IP-NFT listing ${listingId}. Transaction: ${txResponse.transactionId}`);
      return txResponse.transactionId.toString();
    } catch (error) {
      this.logger.error(`Failed to purchase IP-NFT: ${error.message}`);
      throw new BadRequestException(`Failed to purchase IP-NFT: ${error.message}`);
    }
  }

  async cancelListing(listingId: number): Promise<string> {
    try {
      if (!this.marketplaceContractId) {
        throw new BadRequestException('Marketplace contract not initialized');
      }

      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(this.marketplaceContractId)
        .setGas(300000)
        .setFunction(
          'cancelListing',
          new ContractFunctionParameters()
            .addUint256(listingId)
        );

      const txResponse: TransactionResponse = await contractExecuteTx.execute(this.client);
      const receipt: TransactionReceipt = await txResponse.getReceipt(this.client);
      
      if (receipt.status !== Status.Success) {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      this.logger.log(`Cancelled listing ${listingId}. Transaction: ${txResponse.transactionId}`);
      return txResponse.transactionId.toString();
    } catch (error) {
      this.logger.error(`Failed to cancel listing: ${error.message}`);
      throw new BadRequestException(`Failed to cancel listing: ${error.message}`);
    }
  }

  async createAuction(tokenContract: string, tokenId: number, startingPrice: string, durationHours: number): Promise<string> {
    try {
      if (!this.marketplaceContractId) {
        throw new BadRequestException('Marketplace contract not initialized');
      }

      const startingPriceHbar = Hbar.fromTinybars(parseInt(startingPrice));
      const durationSeconds = durationHours * 3600;
      
      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(this.marketplaceContractId)
        .setGas(300000)
        .setFunction(
          'createAuction',
          new ContractFunctionParameters()
            .addAddress(tokenContract)
            .addUint256(tokenId)
            .addUint256(startingPriceHbar.toTinybars())
            .addUint256(durationSeconds)
        );

      const txResponse: TransactionResponse = await contractExecuteTx.execute(this.client);
      const receipt: TransactionReceipt = await txResponse.getReceipt(this.client);
      
      if (receipt.status !== Status.Success) {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      this.logger.log(`Created auction for IP-NFT ${tokenId}. Transaction: ${txResponse.transactionId}`);
      return txResponse.transactionId.toString();
    } catch (error) {
      this.logger.error(`Failed to create auction: ${error.message}`);
      throw new BadRequestException(`Failed to create auction: ${error.message}`);
    }
  }

  async placeBid(auctionId: number, bidAmount: string): Promise<string> {
    try {
      if (!this.marketplaceContractId) {
        throw new BadRequestException('Marketplace contract not initialized');
      }

      const bidHbar = Hbar.fromTinybars(parseInt(bidAmount));
      
      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(this.marketplaceContractId)
        .setGas(300000)
        .setPayableAmount(bidHbar)
        .setFunction(
          'placeBid',
          new ContractFunctionParameters()
            .addUint256(auctionId)
        );

      const txResponse: TransactionResponse = await contractExecuteTx.execute(this.client);
      const receipt: TransactionReceipt = await txResponse.getReceipt(this.client);
      
      if (receipt.status !== Status.Success) {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      this.logger.log(`Placed bid on auction ${auctionId}. Transaction: ${txResponse.transactionId}`);
      return txResponse.transactionId.toString();
    } catch (error) {
      this.logger.error(`Failed to place bid: ${error.message}`);
      throw new BadRequestException(`Failed to place bid: ${error.message}`);
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
    escrowAmount: string
  ): Promise<string> {
    try {
      if (!this.escrowContractId) {
        throw new BadRequestException('Escrow contract not initialized');
      }

      const escrowHbar = Hbar.fromTinybars(parseInt(escrowAmount));
      
      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(this.escrowContractId)
        .setGas(500000)
        .setPayableAmount(escrowHbar)
        .setFunction(
          'createEscrow',
          new ContractFunctionParameters()
            .addAddress(tokenContract)
            .addUint256(tokenId)
            .addAddress(buyer)
            .addUint256(completionDays)
            .addUint8Array(verificationTypes)
            .addStringArray(verificationDescriptions)
            .addBytes32Array(expectedHashes.map(h => Buffer.from(h.replace('0x', ''), 'hex')))
            .addUint256Array(verificationDeadlines)
        );

      const txResponse: TransactionResponse = await contractExecuteTx.execute(this.client);
      const receipt: TransactionReceipt = await txResponse.getReceipt(this.client);
      
      if (receipt.status !== Status.Success) {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      this.logger.log(`Created escrow for IP-NFT ${tokenId}. Transaction: ${txResponse.transactionId}`);
      return txResponse.transactionId.toString();
    } catch (error) {
      this.logger.error(`Failed to create escrow: ${error.message}`);
      throw new BadRequestException(`Failed to create escrow: ${error.message}`);
    }
  }

  async submitVerification(escrowId: number, requirementIndex: number, evidence: string, documentHash: string): Promise<string> {
    try {
      if (!this.escrowContractId) {
        throw new BadRequestException('Escrow contract not initialized');
      }

      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(this.escrowContractId)
        .setGas(300000)
        .setFunction(
          'submitVerification',
          new ContractFunctionParameters()
            .addUint256(escrowId)
            .addUint256(requirementIndex)
            .addString(evidence)
            .addBytes32(Buffer.from(documentHash.replace('0x', ''), 'hex'))
        );

      const txResponse: TransactionResponse = await contractExecuteTx.execute(this.client);
      const receipt: TransactionReceipt = await txResponse.getReceipt(this.client);
      
      if (receipt.status !== Status.Success) {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      this.logger.log(`Submitted verification for escrow ${escrowId}. Transaction: ${txResponse.transactionId}`);
      return txResponse.transactionId.toString();
    } catch (error) {
      this.logger.error(`Failed to submit verification: ${error.message}`);
      throw new BadRequestException(`Failed to submit verification: ${error.message}`);
    }
  }

  async approveVerification(escrowId: number, requirementIndex: number, comment: string): Promise<string> {
    try {
      if (!this.escrowContractId) {
        throw new BadRequestException('Escrow contract not initialized');
      }

      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(this.escrowContractId)
        .setGas(300000)
        .setFunction(
          'approveVerification',
          new ContractFunctionParameters()
            .addUint256(escrowId)
            .addUint256(requirementIndex)
            .addString(comment)
        );

      const txResponse: TransactionResponse = await contractExecuteTx.execute(this.client);
      const receipt: TransactionReceipt = await txResponse.getReceipt(this.client);
      
      if (receipt.status !== Status.Success) {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      this.logger.log(`Approved verification for escrow ${escrowId}. Transaction: ${txResponse.transactionId}`);
      return txResponse.transactionId.toString();
    } catch (error) {
      this.logger.error(`Failed to approve verification: ${error.message}`);
      throw new BadRequestException(`Failed to approve verification: ${error.message}`);
    }
  }

  async completeEscrow(escrowId: number): Promise<string> {
    try {
      if (!this.escrowContractId) {
        throw new BadRequestException('Escrow contract not initialized');
      }

      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(this.escrowContractId)
        .setGas(300000)
        .setFunction(
          'completeEscrow',
          new ContractFunctionParameters()
            .addUint256(escrowId)
        );

      const txResponse: TransactionResponse = await contractExecuteTx.execute(this.client);
      const receipt: TransactionReceipt = await txResponse.getReceipt(this.client);
      
      if (receipt.status !== Status.Success) {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      this.logger.log(`Completed escrow ${escrowId}. Transaction: ${txResponse.transactionId}`);
      return txResponse.transactionId.toString();
    } catch (error) {
      this.logger.error(`Failed to complete escrow: ${error.message}`);
      throw new BadRequestException(`Failed to complete escrow: ${error.message}`);
    }
  }

  // Query Functions

  async getListing(listingId: number): Promise<MarketplaceListing> {
    try {
      if (!this.marketplaceContractId) {
        throw new BadRequestException('Marketplace contract not initialized');
      }

      const contractCallQuery = new ContractCallQuery()
        .setContractId(this.marketplaceContractId)
        .setGas(100000)
        .setFunction(
          'getListing',
          new ContractFunctionParameters()
            .addUint256(listingId)
        );

      const result = await contractCallQuery.execute(this.client);
      
      // Parse the result based on the expected return structure
      // This is a simplified example - you'll need to properly decode the result
      const listing: MarketplaceListing = {
        listingId: listingId,
        tokenContract: result.getString(0),
        tokenId: result.getUint256(1).toNumber(),
        seller: result.getString(2),
        price: result.getUint256(3).toString(),
        active: result.getBool(4),
        createdAt: result.getUint256(5).toNumber()
      };

      return listing;
    } catch (error) {
      this.logger.error(`Failed to get listing: ${error.message}`);
      throw new BadRequestException(`Failed to get listing: ${error.message}`);
    }
  }

  async getEscrow(escrowId: number): Promise<EscrowDetails> {
    try {
      if (!this.escrowContractId) {
        throw new BadRequestException('Escrow contract not initialized');
      }

      const contractCallQuery = new ContractCallQuery()
        .setContractId(this.escrowContractId)
        .setGas(100000)
        .setFunction(
          'getEscrow',
          new ContractFunctionParameters()
            .addUint256(escrowId)
        );

      const result = await contractCallQuery.execute(this.client);
      
      // Parse the result based on the expected return structure
      const escrow: EscrowDetails = {
        id: escrowId,
        tokenContract: result.getString(0),
        tokenId: result.getUint256(1).toNumber(),
        seller: result.getString(2),
        buyer: result.getString(3),
        price: result.getUint256(4).toString(),
        status: result.getUint8(5),
        createdAt: result.getUint256(6).toNumber(),
        completionDeadline: result.getUint256(7).toNumber()
      };

      return escrow;
    } catch (error) {
      this.logger.error(`Failed to get escrow: ${error.message}`);
      throw new BadRequestException(`Failed to get escrow: ${error.message}`);
    }
  }

  // Additional methods needed by controllers

  async getAuction(auctionId: number): Promise<MarketplaceAuction> {
    try {
      if (!this.marketplaceContractId) {
        throw new BadRequestException('Marketplace contract not initialized');
      }

      const contractCallQuery = new ContractCallQuery()
        .setContractId(this.marketplaceContractId)
        .setGas(100000)
        .setFunction(
          'getAuction',
          new ContractFunctionParameters()
            .addUint256(auctionId)
        );

      const result = await contractCallQuery.execute(this.client);
      
      const auction: MarketplaceAuction = {
        auctionId: auctionId,
        tokenContract: result.getString(0),
        tokenId: result.getUint256(1).toNumber(),
        seller: result.getString(2),
        startingPrice: result.getUint256(3).toString(),
        currentBid: result.getUint256(4).toString(),
        currentBidder: result.getString(5),
        endTime: result.getUint256(6).toNumber(),
        active: result.getBool(7),
        createdAt: result.getUint256(8).toNumber()
      };

      return auction;
    } catch (error) {
      this.logger.error(`Failed to get auction: ${error.message}`);
      throw new BadRequestException(`Failed to get auction: ${error.message}`);
    }
  }

  async endAuction(auctionId: number): Promise<string> {
    try {
      if (!this.marketplaceContractId) {
        throw new BadRequestException('Marketplace contract not initialized');
      }

      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(this.marketplaceContractId)
        .setGas(300000)
        .setFunction(
          'endAuction',
          new ContractFunctionParameters()
            .addUint256(auctionId)
        );

      const txResponse: TransactionResponse = await contractExecuteTx.execute(this.client);
      const receipt: TransactionReceipt = await txResponse.getReceipt(this.client);
      
      if (receipt.status !== Status.Success) {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      this.logger.log(`Ended auction ${auctionId}. Transaction: ${txResponse.transactionId}`);
      return txResponse.transactionId.toString();
    } catch (error) {
      this.logger.error(`Failed to end auction: ${error.message}`);
      throw new BadRequestException(`Failed to end auction: ${error.message}`);
    }
  }

  async getMarketplaceStats(): Promise<{ totalListings: number; totalAuctions: number }> {
    try {
      if (!this.marketplaceContractId) {
        throw new BadRequestException('Marketplace contract not initialized');
      }

      // Get total listings
      const listingsQuery = new ContractCallQuery()
        .setContractId(this.marketplaceContractId)
        .setGas(100000)
        .setFunction('getTotalListings');

      const listingsResult = await listingsQuery.execute(this.client);
      const totalListings = listingsResult.getUint256(0).toNumber();

      // Get total auctions
      const auctionsQuery = new ContractCallQuery()
        .setContractId(this.marketplaceContractId)
        .setGas(100000)
        .setFunction('getTotalAuctions');

      const auctionsResult = await auctionsQuery.execute(this.client);
      const totalAuctions = auctionsResult.getUint256(0).toNumber();

      return { totalListings, totalAuctions };
    } catch (error) {
      this.logger.error(`Failed to get marketplace stats: ${error.message}`);
      throw new BadRequestException(`Failed to get marketplace stats: ${error.message}`);
    }
  }

  async getTotalEscrows(): Promise<number> {
    try {
      if (!this.escrowContractId) {
        throw new BadRequestException('Escrow contract not initialized');
      }

      const contractCallQuery = new ContractCallQuery()
        .setContractId(this.escrowContractId)
        .setGas(100000)
        .setFunction('getTotalEscrows');

      const result = await contractCallQuery.execute(this.client);
      return result.getUint256(0).toNumber();
    } catch (error) {
      this.logger.error(`Failed to get total escrows: ${error.message}`);
      throw new BadRequestException(`Failed to get total escrows: ${error.message}`);
    }
  }

  async raiseDispute(escrowId: number, reason: string): Promise<string> {
    try {
      if (!this.escrowContractId) {
        throw new BadRequestException('Escrow contract not initialized');
      }

      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(this.escrowContractId)
        .setGas(300000)
        .setFunction(
          'raiseDispute',
          new ContractFunctionParameters()
            .addUint256(escrowId)
            .addString(reason)
        );

      const txResponse: TransactionResponse = await contractExecuteTx.execute(this.client);
      const receipt: TransactionReceipt = await txResponse.getReceipt(this.client);
      
      if (receipt.status !== Status.Success) {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      this.logger.log(`Raised dispute for escrow ${escrowId}. Transaction: ${txResponse.transactionId}`);
      return txResponse.transactionId.toString();
    } catch (error) {
      this.logger.error(`Failed to raise dispute: ${error.message}`);
      throw new BadRequestException(`Failed to raise dispute: ${error.message}`);
    }
  }

  async resolveDispute(escrowId: number, winner: string, resolution: string): Promise<string> {
    try {
      if (!this.escrowContractId) {
        throw new BadRequestException('Escrow contract not initialized');
      }

      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(this.escrowContractId)
        .setGas(300000)
        .setFunction(
          'resolveDispute',
          new ContractFunctionParameters()
            .addUint256(escrowId)
            .addAddress(winner)
            .addString(resolution)
        );

      const txResponse: TransactionResponse = await contractExecuteTx.execute(this.client);
      const receipt: TransactionReceipt = await txResponse.getReceipt(this.client);
      
      if (receipt.status !== Status.Success) {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      this.logger.log(`Resolved dispute for escrow ${escrowId}. Transaction: ${txResponse.transactionId}`);
      return txResponse.transactionId.toString();
    } catch (error) {
      this.logger.error(`Failed to resolve dispute: ${error.message}`);
      throw new BadRequestException(`Failed to resolve dispute: ${error.message}`);
    }
  }
}
