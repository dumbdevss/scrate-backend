import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
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
  Status,
  TokenAssociateTransaction
} from '@hashgraph/sdk';

interface MarketplaceListing {
  listingId: number;
  tokenAddress: string;
  serialNumber: number;
  seller: string;
  price: string;
  active: boolean;
  createdAt: number;
}

interface MarketplaceAuction {
  auctionId: number;
  tokenAddress: string;
  serialNumber: number;
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
  tokenAddress: string;
  serialNumber: number;
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
  
  // Hedera properties
  private client: Client;
  private operatorId: AccountId;
  private operatorKey: PrivateKey;
  private marketplaceContractId: ContractId;
  private escrowContractId: ContractId;
  
  // ERC721 properties
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private erc721MarketplaceContract: ethers.Contract;
  private erc721EscrowContract: ethers.Contract;
  private erc721ContractAddresses: {
    marketplace: string;
    escrow: string;
  };

  constructor(private configService: ConfigService) {
    this.initializeClient();
    this.initializeERC721();
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

      console.log('Marketplace contract address:', marketplaceAddress);
      console.log('Escrow contract address:', escrowAddress);

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

  private initializeERC721() {
    const rpcUrl = this.configService.get<string>('RPC_URL');
    const privateKey = this.configService.get<string>('PRIVATE_KEY');

    if (!rpcUrl || !privateKey) {
      this.logger.warn('RPC_URL and PRIVATE_KEY not provided - ERC721 functionality will be disabled');
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      
      this.erc721ContractAddresses = {
        marketplace: this.configService.get<string>('MARKETPLACE_CONTRACT_ADDRESS', ''),
        escrow: this.configService.get<string>('ESCROW_CONTRACT_ADDRESS', ''),
      };

      // Initialize ERC721 contracts with basic ABIs
      if (this.erc721ContractAddresses.marketplace) {
        const marketplaceAbi = [
          "function listItem(address tokenAddress, uint256 tokenId, uint256 price) external",
          "function purchaseItem(uint256 listingId) external payable",
          "function cancelListing(uint256 listingId) external",
          "function createAuction(address tokenAddress, uint256 tokenId, uint256 startingPrice, uint256 duration) external",
          "function placeBid(uint256 auctionId) external payable",
          "function endAuction(uint256 auctionId) external"
        ];
        
        this.erc721MarketplaceContract = new ethers.Contract(
          this.erc721ContractAddresses.marketplace,
          marketplaceAbi,
          this.wallet
        );
      }

      if (this.erc721ContractAddresses.escrow) {
        const escrowAbi = [
          "function createEscrow(address tokenAddress, uint256 tokenId, address buyer, uint256 completionDays, uint8[] verificationTypes, string[] verificationDescriptions, bytes32[] expectedHashes, uint256[] verificationDeadlines) external payable",
          "function completeEscrow(uint256 escrowId) external",
          "function submitVerification(uint256 escrowId, uint256 requirementIndex, string evidence, bytes32 documentHash) external",
          "function approveVerification(uint256 escrowId, uint256 requirementIndex, string comment) external"
        ];
        
        this.erc721EscrowContract = new ethers.Contract(
          this.erc721ContractAddresses.escrow,
          escrowAbi,
          this.wallet
        );
      }

      this.logger.log('ERC721 contracts initialized');
    } catch (error) {
      this.logger.error(`Failed to initialize ERC721: ${error.message}`);
    }
  }

  // Marketplace Functions

  async listIPNFT(tokenAddress: string, serialNumber: number, price: string): Promise<string> {
    try {
      if (!this.marketplaceContractId) {
        throw new BadRequestException('Marketplace contract not initialized');
      }

      console.log('Listing IP-NFT...', tokenAddress, serialNumber, price, this.marketplaceContractId);
      const priceHbar = Hbar.fromTinybars(parseInt(price));

      console.log(this.marketplaceContractId.toSolidityAddress());

      const associateAliceTx = new TokenAssociateTransaction()
        .setAccountId(AccountId.fromString('0.0.7133898'))
        .setTokenIds(['0.0.7126251'])
        .freezeWith(this.client)

      const signTxAssociateAlice = await associateAliceTx.sign(this.operatorKey);

      // Submit the transaction to a Hedera network
      const associateAliceTxSubmit = await signTxAssociateAlice.execute(this.client);

      // Get the transaction receipt
      const associateAliceRx = await associateAliceTxSubmit.getReceipt(this.client);

      console.log('Associate Alice receipt:', associateAliceRx);

      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(this.marketplaceContractId)
        .setGas(15_000_000)
        .setFunction(
          'listItem',
          new ContractFunctionParameters()
            .addAddress(tokenAddress)
            .addInt64(serialNumber)
            .addUint256(priceHbar.toTinybars())
        )

      let signExecuteTx = await contractExecuteTx.sign(this.operatorKey);

      const txResponse: TransactionResponse = await signExecuteTx.execute(this.client);
      const receipt: TransactionReceipt = await txResponse.getReceipt(this.client);

      if (receipt.status !== Status.Success) {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      this.logger.log(`Listed IP-NFT ${serialNumber} for ${price} HBAR. Transaction: ${txResponse.transactionId}`);
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

  async createAuction(tokenAddress: string, serialNumber: number, startingPrice: string, durationHours: number): Promise<string> {
    try {
      if (!this.marketplaceContractId) {
        throw new BadRequestException('Marketplace contract not initialized');
      }

      const startingPriceHbar = Hbar.fromTinybars(parseInt(startingPrice));
      const durationSeconds = durationHours * 3600;

      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(this.marketplaceContractId)
        .setGas(400000)
        .setFunction(
          'createAuction',
          new ContractFunctionParameters()
            .addAddress(tokenAddress)
            .addInt64(serialNumber)
            .addUint256(startingPriceHbar.toTinybars())
            .addUint256(durationSeconds)
        );

      const txResponse: TransactionResponse = await contractExecuteTx.execute(this.client);
      const receipt: TransactionReceipt = await txResponse.getReceipt(this.client);

      if (receipt.status !== Status.Success) {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      this.logger.log(`Created auction for IP-NFT ${serialNumber}. Transaction: ${txResponse.transactionId}`);
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
    tokenAddress: string,
    serialNumber: number,
    buyer: string,
    completionDays: number,
    verificationTypes: number[],
    verificationDescriptions: string[],
    expectedHashes: string[],
    verificationDeadlines: number[],
    price: string
  ): Promise<string> {
    try {
      if (!this.escrowContractId) {
        throw new BadRequestException('Escrow contract not initialized');
      }

      const priceHbar = Hbar.fromTinybars(parseInt(price));

      // Convert verification types to enum values
      const verificationTypesUint8 = verificationTypes.map(t => t as number);

      const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(this.escrowContractId)
        .setGas(500000)
        .setPayableAmount(priceHbar)
        .setFunction(
          'createEscrow',
          new ContractFunctionParameters()
            .addAddress(tokenAddress)
            .addInt64(serialNumber)
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

      this.logger.log(`Created escrow for IP-NFT ${serialNumber}. Transaction: ${txResponse.transactionId}`);
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

      const result = await this.queryContract(
        this.marketplaceContractId,
        'getListing',
        new ContractFunctionParameters()
          .addUint256(listingId)
      );

      return {
        listingId: result.getUint256(0).toNumber(),
        tokenAddress: result.getAddress(1),
        serialNumber: result.getInt64(2).toNumber(),
        seller: result.getAddress(3),
        price: result.getUint256(4).toString(),
        active: result.getBool(5),
        createdAt: result.getUint256(6).toNumber()
      };
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

      const result = await this.queryContract(
        this.escrowContractId,
        'getEscrow',
        new ContractFunctionParameters()
          .addUint256(escrowId)
      );

      return {
        id: result.getUint256(0).toNumber(),
        tokenAddress: result.getAddress(1),
        serialNumber: result.getInt64(2).toNumber(),
        seller: result.getAddress(3),
        buyer: result.getAddress(4),
        price: result.getUint256(5).toString(),
        status: result.getUint8(6),
        createdAt: result.getUint256(7).toNumber(),
        completionDeadline: result.getUint256(8).toNumber()
      };
    } catch (error) {
      this.logger.error(`Failed to get escrow: ${error.message}`);
      throw new BadRequestException(`Failed to get escrow: ${error.message}`);
    }
  }

  async getAuction(auctionId: number): Promise<MarketplaceAuction> {
    try {
      if (!this.marketplaceContractId) {
        throw new BadRequestException('Marketplace contract not initialized');
      }

      const result = await this.queryContract(
        this.marketplaceContractId,
        'getAuction',
        new ContractFunctionParameters()
          .addUint256(auctionId)
      );

      return {
        auctionId: result.getUint256(0).toNumber(),
        tokenAddress: result.getAddress(1),
        serialNumber: result.getInt64(2).toNumber(),
        seller: result.getAddress(3),
        startingPrice: result.getUint256(4).toString(),
        currentBid: result.getUint256(5).toString(),
        currentBidder: result.getAddress(6),
        endTime: result.getUint256(7).toNumber(),
        active: result.getBool(8),
        createdAt: result.getUint256(9).toNumber()
      };
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

      const result = await this.queryContract(
        this.escrowContractId,
        'getTotalEscrows',
        new ContractFunctionParameters()
      );

      return result.getUint256(0).toNumber();
    } catch (error) {
      this.logger.error(`Failed to get total escrows: ${error.message}`);
      throw new BadRequestException(`Failed to get total escrows: ${error.message}`);
    }
  }

  private async queryContract(contractId: ContractId, functionName: string, params: ContractFunctionParameters) {
    try {
      const query = new ContractCallQuery()
        .setContractId(contractId)
        .setGas(100000)
        .setFunction(functionName, params);

      const result = await query.execute(this.client);
      return result;
    } catch (error) {
      this.logger.error(`Contract query failed: ${error.message}`);
      throw new Error(`Contract query failed: ${error.message}`);
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

  // ERC721 Methods
  async listIPNFTERC721(tokenAddress: string, tokenId: string, price: string): Promise<string> {
    try {
      if (!this.erc721MarketplaceContract) {
        throw new BadRequestException('ERC721 Marketplace contract not initialized');
      }

      this.logger.log(`Listing ERC721 IP-NFT: ${tokenAddress}:${tokenId} for ${price} wei`);

      const tx = await this.erc721MarketplaceContract.listItem(
        tokenAddress,
        tokenId,
        ethers.parseEther(price)
      );

      await tx.wait();
      this.logger.log(`ERC721 IP-NFT listed successfully. Transaction: ${tx.hash}`);

      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to list ERC721 IP-NFT: ${error.message}`);
      throw new BadRequestException(`Failed to list ERC721 IP-NFT: ${error.message}`);
    }
  }

  async purchaseIPNFTERC721(listingId: string, paymentAmount: string): Promise<string> {
    try {
      if (!this.erc721MarketplaceContract) {
        throw new BadRequestException('ERC721 Marketplace contract not initialized');
      }

      const tx = await this.erc721MarketplaceContract.purchaseItem(listingId, {
        value: ethers.parseEther(paymentAmount)
      });

      await tx.wait();
      this.logger.log(`ERC721 IP-NFT purchased successfully. Transaction: ${tx.hash}`);

      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to purchase ERC721 IP-NFT: ${error.message}`);
      throw new BadRequestException(`Failed to purchase ERC721 IP-NFT: ${error.message}`);
    }
  }

  async createEscrowERC721(
    tokenAddress: string,
    tokenId: string,
    buyer: string,
    completionDays: number,
    verificationTypes: number[],
    verificationDescriptions: string[],
    expectedHashes: string[],
    verificationDeadlines: number[],
    price: string
  ): Promise<string> {
    try {
      if (!this.erc721EscrowContract) {
        throw new BadRequestException('ERC721 Escrow contract not initialized');
      }

      // Convert expected hashes to bytes32
      const expectedHashesBytes32 = expectedHashes.map(hash => 
        ethers.keccak256(ethers.toUtf8Bytes(hash))
      );

      const tx = await this.erc721EscrowContract.createEscrow(
        tokenAddress,
        tokenId,
        buyer,
        completionDays,
        verificationTypes,
        verificationDescriptions,
        expectedHashesBytes32,
        verificationDeadlines,
        {
          value: ethers.parseEther(price)
        }
      );

      await tx.wait();
      this.logger.log(`ERC721 Escrow created successfully. Transaction: ${tx.hash}`);

      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to create ERC721 escrow: ${error.message}`);
      throw new BadRequestException(`Failed to create ERC721 escrow: ${error.message}`);
    }
  }

  // Utility method to get ERC721 contract addresses
  getERC721ContractAddresses() {
    return this.erc721ContractAddresses;
  }
}
