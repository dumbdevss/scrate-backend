import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinataSDK } from "pinata";
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';
import {
  Client,
  AccountId,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenMintTransaction,
  TokenInfoQuery,
  TransactionResponse,
  Hbar,
  TokenNftInfoQuery,
  TransferTransaction,
  TokenAssociateTransaction,
  NftId,
} from '@hashgraph/sdk';
import {
  MintIPNFTDto,
  IPNFTAnalyticsDto
} from '../dto/ipnft.dto';
import {
  HederaConfig,
  CollectionInfo,
  MintResult,
  NftInfo
} from '../interfaces/hedera.interface';

interface IPNFTMetadata {
  schema_version: string;
  name: string;
  description: string;
  image?: string;
  external_url?: string;
  properties: {
    type: 'IP-NFT';
    agreements: any[];
    project_details: any;
    hedera_metadata?: {
      token_id: string;
      token_address: string;
      minted_at: string;
      minter_account: string;
      network: string;
    };
  };
}

export interface ContractAddresses {
  ipnft: string;
  marketplace: string;
  escrow: string;
}

export interface ERC721MintResult {
  tokenId: string;
  transactionHash: string;
  contractAddress: string;
}

@Injectable()
export class HederaService {
  private readonly logger = new Logger(HederaService.name);
  
  // Hedera properties
  private client: Client;
  private operatorId: AccountId;
  private operatorKey: PrivateKey;
  private ipnftCollectionId: string;
  
  // ERC721 properties
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private ipnftContract: ethers.Contract;
  private marketplaceContract: ethers.Contract;
  private escrowContract: ethers.Contract;
  private contractAddresses: ContractAddresses;
  
  // Shared properties
  private supabase: SupabaseClient;
  private pinata: PinataSDK;

  constructor(private configService: ConfigService) {
    this.initializeClient();
    this.initializeERC721();
    this.initializeSupabase();
    this.initializePinata();
  }

  private initializeClient() {
    const config: HederaConfig = {
      operatorId: this.configService.get<string>('HEDERA_OPERATOR_ID'),
      operatorKey: this.configService.get<string>('HEDERA_OPERATOR_KEY'),
      network: this.configService.get<'testnet' | 'mainnet' | 'previewnet'>('HEDERA_NETWORK', 'testnet'),
    };

    if (!config.operatorId || !config.operatorKey) {
      throw new Error('Hedera operator ID and key must be provided in environment variables');
    }

    this.operatorId = AccountId.fromString(config.operatorId);
    this.operatorKey = PrivateKey.fromStringECDSA(config.operatorKey);

    switch (config.network) {
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
    this.logger.log(`Hedera client initialized for ${config.network}`);

    // Set the IP-NFT collection ID from config or create one
    this.ipnftCollectionId = this.configService.get<string>('IPNFT_COLLECTION_ID', '');
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
      
      this.contractAddresses = {
        ipnft: this.configService.get<string>('IPNFT_CONTRACT_ADDRESS', ''),
        marketplace: this.configService.get<string>('MARKETPLACE_CONTRACT_ADDRESS', ''),
        escrow: this.configService.get<string>('ESCROW_CONTRACT_ADDRESS', ''),
      };

      // Initialize contracts if addresses are provided
      if (this.contractAddresses.ipnft) {
        // Note: In production, you'd import the actual ABI
        const ipnftAbi = [
          "function mint(address to, string memory title, string memory description, string memory ipType, string memory uri, string[] memory tags, bytes32 contentHash) public returns (uint256)",
          "function ownerOf(uint256 tokenId) public view returns (address)",
          "function tokenURI(uint256 tokenId) public view returns (string memory)",
          "function totalSupply() public view returns (uint256)",
          "event IPNFTMinted(uint256 indexed tokenId, address indexed owner, string title)"
        ];
        
        this.ipnftContract = new ethers.Contract(
          this.contractAddresses.ipnft,
          ipnftAbi,
          this.wallet
        );
      }

      this.logger.log('ERC721 provider and contracts initialized');
    } catch (error) {
      this.logger.error(`Failed to initialize ERC721: ${error.message}`);
    }
  }

  private initializeSupabase() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn('SUPABASE_URL and SUPABASE_ANON_KEY must be provided in environment variables');
      throw new Error('Supabase configuration is required');
    }

    try {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.logger.log('Supabase client initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Supabase client: ${error.message}`);
      throw error;
    }
  }

  private initializePinata() {
    const pinata = new PinataSDK({
      pinataJwt: process.env.PINATA_JWT!,
      pinataGateway: "violet-patient-squid-248.mypinata.cloud",
    });

    this.pinata = pinata;
  }

  async createIPNFTCollection(): Promise<CollectionInfo> {
    try {
      this.logger.log('Creating IP-NFT collection');

      const tokenCreateTx = new TokenCreateTransaction()
        .setTokenName('Intellectual Property NFTs')
        .setTokenSymbol('IPNFT')
        .setTokenType(TokenType.NonFungibleUnique)
        .setTreasuryAccountId(this.operatorId)
        .setSupplyKey(this.operatorKey)
        .freezeWith(this.client)

      const signTxTokenCreate = await tokenCreateTx.sign(this.operatorKey);

      const tokenCreateSubmit = await signTxTokenCreate.execute(this.client);

      const tokenCreateReceipt = await tokenCreateSubmit.getReceipt(this.client);
      const tokenId = tokenCreateReceipt.tokenId;

      if (!tokenId) {
        throw new BadRequestException('Failed to create IP-NFT collection');
      }

      this.ipnftCollectionId = tokenId.toString();
      this.logger.log(`IP-NFT collection created with token ID: ${tokenId.toString()}`);

      const collectionInfo: CollectionInfo = {
        tokenId: tokenId.toString(),
        tokenAddress: `0.0.${tokenId.num}`,
        name: 'Intellectual Property NFTs',
        symbol: 'IPNFT',
        totalSupply: 0,
        treasuryAccountId: this.operatorId.toString(),
      };

      // Store collection info in database
      const { data, error } = await this.supabase.from('ipnft_collections').insert({
        token_id: tokenId.toString(),
        token_address: `0.0.${tokenId.num}`,
        name: 'Intellectual Property NFTs',
        symbol: 'IPNFT',
        created_at: new Date().toISOString(),
        treasury_account: collectionInfo.treasuryAccountId
      });

      if (error) {
        this.logger.error(`Failed to store collection in database: ${error.message}`);
        // Don't throw here as the token was created successfully on Hedera
        this.logger.warn('Collection created on Hedera but not stored in database');
      } else {
        this.logger.log('Collection info stored in database successfully');
      }

      return collectionInfo;
    } catch (error) {
      this.logger.error(`Failed to create IP-NFT collection: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to create IP-NFT collection: ${error.message}`);
    }
  }

  async uploadNFTMetadata(metadata: Record<string, any>) {
    try {
      // Upload metadata JSON
      console.log("Uploading metadata:", metadata);
      const file = new File([JSON.stringify(metadata)], "metadata.json", {
        type: "application/json",
      });

      const upload: any = await this.pinata.upload.public.file(file);
      console.log("✅ Metadata uploaded:", upload);

      const ipfsUri = `ipfs://${upload.cid}`;
      console.log("✅ Metadata uploaded:", ipfsUri);

      return ipfsUri;
    } catch (error) {
      console.error("❌ Failed to upload metadata:", error);
      throw error;
    }
  }

  async mintIPNFT(mintDto: MintIPNFTDto): Promise<MintResult> {
    try {
      this.logger.log(`Minting IP-NFT: ${mintDto.name}`);

      if (!this.ipnftCollectionId) {
        throw new BadRequestException('IP-NFT collection not initialized');
      }

      const tokenId = AccountId.fromString(this.ipnftCollectionId);
      const recipientId = AccountId.fromString(mintDto.recipient);

      // Create comprehensive metadata
      const metadata: IPNFTMetadata = {
        schema_version: '1.0.0',
        name: mintDto.name,
        description: mintDto.description,
        image: mintDto.image,
        external_url: mintDto.external_url,
        properties: {
          type: 'IP-NFT',
          agreements: mintDto.agreements,
          project_details: mintDto.project_details,
          hedera_metadata: {
            token_id: this.ipnftCollectionId,
            token_address: `0.0.${tokenId.num}`,
            minted_at: new Date().toISOString(),
            minter_account: this.operatorId.toString(),
            network: this.configService.get<string>('HEDERA_NETWORK', 'testnet'),
          },
        },
      };

      const metadataUrl = await this.uploadNFTMetadata(metadata);
      console.log("✅ Metadata uploaded:", metadataUrl);

      const mintTx = new TokenMintTransaction()
        .setTokenId(this.ipnftCollectionId)
        .addMetadata(Buffer.from(metadataUrl))
        .setMaxTransactionFee(new Hbar(20));

      const signTxMint = await mintTx.freezeWith(this.client).sign(this.operatorKey);

      const mintTxSubmit = await signTxMint.execute(this.client);
      const mintRx = await mintTxSubmit.getReceipt(this.client);
      const serialNumbers = mintRx.serials;

      if (!serialNumbers || serialNumbers.length === 0) {
        throw new BadRequestException('Failed to mint IP-NFT - no serial numbers returned');
      }

      // Transfer to recipient if different from operator
      // if (recipientId.toString() !== this.operatorId.toString()) {

      //   // Create the associate transaction and sign with Alice's key 
      //   const associateAliceTx = new TokenAssociateTransaction()
      //     .setAccountId(recipientId)
      //     .setTokenIds([this.ipnftCollectionId])
      //     .freezeWith(this.client)

      //   const signTxAssociateAlice = await associateAliceTx.sign(this.operatorKey);

      //   // Submit the transaction to a Hedera network
      //   const associateAliceTxSubmit = await signTxAssociateAlice.execute(this.client);

      //   // Get the transaction receipt
      //   const associateAliceRx = await associateAliceTxSubmit.getReceipt(this.client);

      //   console.log("✅ Associate transaction submitted:", associateAliceRx);

      //   const transferTx = new TransferTransaction()
      //     .addNftTransfer(this.ipnftCollectionId, serialNumbers[0], this.operatorId, recipientId)
      //     .freezeWith(this.client)

      //   let signTxTransfer = await transferTx.sign(this.operatorKey);

      //   console.log("✅ Transfer transaction created:", transferTx);

      //   let transferTxSubmit = await signTxTransfer.execute(this.client);
      //   let transferRx = await transferTxSubmit.getReceipt(this.client);

      //   console.log("✅ Transfer transaction submitted:", transferRx);
      // }

      const serialNumber = serialNumbers[0].toNumber();
      this.logger.log(`IP-NFT minted with serial number: ${serialNumber}`);

      // Store in database
      const ipnftRecord = {
        token_id: this.ipnftCollectionId,
        serial_number: serialNumber,
        owner_account: mintDto.recipient,
        metadata: JSON.stringify(metadata),
        name: mintDto.name,
        description: mintDto.description,
        industry: mintDto.project_details.industry,
        organization: mintDto.project_details.organization,
        topic: mintDto.project_details.topic,
        minted_at: new Date().toISOString(),
        transaction_id: mintTxSubmit.transactionId?.toString() || '',
      };

      const { data: insertData, error: insertError } = await this.supabase.from('ipnfts').insert(ipnftRecord);

      if (insertError) {
        this.logger.error(`Failed to store IP-NFT in database: ${insertError.message}`);
        // Don't throw here as the NFT was minted successfully on Hedera
        this.logger.warn('IP-NFT minted on Hedera but not stored in database');
      } else {
        this.logger.log('IP-NFT info stored in database successfully');
      }

      // Update analytics
      await this.updateAnalytics('mint', 1);

      const nftInfo: NftInfo = {
        tokenId: this.ipnftCollectionId,
        serialNumber: serialNumber,
        accountId: mintDto.recipient,
        metadata: metadata,
        createdTimestamp: new Date().toISOString(),
      };

      const result: MintResult = {
        tokenId: this.ipnftCollectionId,
        serialNumbers: [serialNumber],
        transactionId: mintTxSubmit.transactionId?.toString() || '',
        nftInfo: [nftInfo],
      };

      return result;
    } catch (error) {
      this.logger.error(`Failed to mint IP-NFT: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to mint IP-NFT: ${error.message}`);
    }
  }

  async getIPNFTInfo(serialNumber: number): Promise<NftInfo> {
    try {
      if (!this.ipnftCollectionId) {
        throw new BadRequestException('IP-NFT collection not initialized');
      }

      const nftInfo = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/tokens/${this.ipnftCollectionId}/nfts/${serialNumber}`)
        .then(response => response.json());

      return {
        tokenId: this.ipnftCollectionId,
        serialNumber: serialNumber,
        accountId: nftInfo.account_id,
        metadata: Buffer.from(nftInfo.metadata || []).toString(),
        createdTimestamp: nftInfo.created_timestamp,
      };
    } catch (error) {
      this.logger.error(`Failed to get IP-NFT info: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to get IP-NFT info: ${error.message}`);
    }
  }

  async getAnalytics(): Promise<IPNFTAnalyticsDto> {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get analytics from database with proper error handling
      const { data: totalMinted, error: mintedError } = await this.supabase
        .from('ipnfts')
        .select('*');

      if (mintedError) {
        this.logger.error(`Failed to get minted NFTs: ${mintedError.message}`);
      }

      const { data: dailyTransactions, error: transactionsError } = await this.supabase
        .from('transactions')
        .select('*')
        .gte('created_at', today);

      if (transactionsError) {
        this.logger.error(`Failed to get daily transactions: ${transactionsError.message}`);
      }

      const { data: activeListings, error: listingsError } = await this.supabase
        .from('marketplace_listings')
        .select('*')
        .eq('status', 'active');

      if (listingsError) {
        this.logger.error(`Failed to get active listings: ${listingsError.message}`);
      }

      const { data: activeAuctions, error: auctionsError } = await this.supabase
        .from('marketplace_auctions')
        .select('*')
        .eq('status', 'active');

      if (auctionsError) {
        this.logger.error(`Failed to get active auctions: ${auctionsError.message}`);
      }

      const { data: activeEscrows, error: escrowsError } = await this.supabase
        .from('escrows')
        .select('*')
        .eq('status', 'active');

      if (escrowsError) {
        this.logger.error(`Failed to get active escrows: ${escrowsError.message}`);
      }

      return {
        totalMinted: totalMinted?.length || 0,
        dailyTransactions: dailyTransactions?.length || 0,
        activeListings: activeListings?.length || 0,
        activeAuctions: activeAuctions?.length || 0,
        activeEscrows: activeEscrows?.length || 0,
        totalVolume: 0, // Calculate from transactions
      };
    } catch (error) {
      this.logger.error(`Failed to get analytics: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to get analytics: ${error.message}`);
    }
  }

  private async updateAnalytics(type: string, count: number) {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await this.supabase.from('daily_analytics').insert({
        date: today,
        transaction_type: type,
        count: count,
        created_at: new Date().toISOString(),
      });

      if (error) {
        this.logger.warn(`Failed to update analytics: ${error.message}`);
      } else {
        this.logger.log(`Analytics updated successfully for ${type}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to update analytics: ${error.message}`);
    }
  }

  async validateMetadata(metadata: any): Promise<boolean> {
    try {
      // Basic validation - in production you'd use AJV with the schema
      const required = ['schema_version', 'name', 'description', 'properties'];
      for (const field of required) {
        if (!metadata[field]) {
          return false;
        }
      }

      if (metadata.properties.type !== 'IP-NFT') {
        return false;
      }

      if (!metadata.properties.agreements || !Array.isArray(metadata.properties.agreements)) {
        return false;
      }

      if (!metadata.properties.project_details) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Metadata validation failed: ${error.message}`);
      return false;
    }
  }

  async getCollectionInfo(): Promise<CollectionInfo> {
    console.log(this.ipnftCollectionId);
    if (!this.ipnftCollectionId) {
      throw new BadRequestException('IP-NFT collection not initialized');
    }

    const tokenId = AccountId.fromString(this.ipnftCollectionId);

    console.log(tokenId);
    const tokenInfo = await new TokenInfoQuery()
      .setTokenId(this.ipnftCollectionId)
      .execute(this.client);

    return {
      tokenId: this.ipnftCollectionId,
      tokenAddress: `0.0.${tokenId.num}`,
      name: tokenInfo.name,
      symbol: tokenInfo.symbol,
      totalSupply: tokenInfo.totalSupply.toNumber(),
      treasuryAccountId: tokenInfo.treasuryAccountId?.toString() || '',
    };
  }

  // ERC721 Methods
  async mintIPNFTERC721(
    to: string,
    title: string,
    description: string,
    ipType: string,
    uri: string,
    tags: string[],
    contentHash: string
  ): Promise<ERC721MintResult> {
    try {
      if (!this.ipnftContract) {
        throw new BadRequestException('IPNFT contract not initialized');
      }

      this.logger.log(`Minting ERC721 IP-NFT: ${title} to ${to}`);

      // Convert contentHash to bytes32
      const contentHashBytes32 = ethers.keccak256(ethers.toUtf8Bytes(contentHash));

      const tx = await this.ipnftContract.mint(
        to,
        title,
        description,
        ipType,
        uri,
        tags,
        contentHashBytes32
      );

      const receipt = await tx.wait();
      
      // Extract tokenId from the event logs
      let tokenId = '0';
      for (const log of receipt.logs) {
        try {
          const parsed = this.ipnftContract.interface.parseLog(log);
          if (parsed.name === 'IPNFTMinted') {
            tokenId = parsed.args.tokenId.toString();
            break;
          }
        } catch {
          // Skip logs that don't match our interface
        }
      }

      this.logger.log(`ERC721 IP-NFT minted successfully. Token ID: ${tokenId}, Transaction: ${tx.hash}`);

      // Store in database
      await this.storeERC721NFTInDatabase({
        tokenId,
        contractAddress: this.contractAddresses.ipnft,
        owner: to,
        title,
        description,
        ipType,
        uri,
        tags,
        contentHash,
        transactionHash: tx.hash,
      });

      return {
        tokenId,
        transactionHash: tx.hash,
        contractAddress: this.contractAddresses.ipnft,
      };
    } catch (error) {
      this.logger.error(`Failed to mint ERC721 IP-NFT: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to mint ERC721 IP-NFT: ${error.message}`);
    }
  }

  async getERC721IPNFTInfo(tokenId: string) {
    try {
      if (!this.ipnftContract) {
        throw new BadRequestException('IPNFT contract not initialized');
      }

      const [owner, tokenURI] = await Promise.all([
        this.ipnftContract.ownerOf(tokenId),
        this.ipnftContract.tokenURI(tokenId),
      ]);

      return {
        tokenId,
        owner,
        tokenURI,
        contractAddress: this.contractAddresses.ipnft,
      };
    } catch (error) {
      this.logger.error(`Failed to get ERC721 IP-NFT info: ${error.message}`);
      throw new BadRequestException(`Failed to get ERC721 IP-NFT info: ${error.message}`);
    }
  }

  async getERC721TotalSupply(): Promise<number> {
    try {
      if (!this.ipnftContract) {
        throw new BadRequestException('IPNFT contract not initialized');
      }

      const totalSupply = await this.ipnftContract.totalSupply();
      return parseInt(totalSupply.toString());
    } catch (error) {
      this.logger.error(`Failed to get ERC721 total supply: ${error.message}`);
      throw new BadRequestException(`Failed to get ERC721 total supply: ${error.message}`);
    }
  }

  private async storeERC721NFTInDatabase(nftData: any) {
    try {
      const { data, error } = await this.supabase.from('erc721_ipnfts').insert({
        token_id: nftData.tokenId,
        contract_address: nftData.contractAddress,
        owner: nftData.owner,
        title: nftData.title,
        description: nftData.description,
        ip_type: nftData.ipType,
        token_uri: nftData.uri,
        tags: nftData.tags,
        content_hash: nftData.contentHash,
        transaction_hash: nftData.transactionHash,
        created_at: new Date().toISOString(),
      });

      if (error) {
        this.logger.error(`Failed to store ERC721 NFT in database: ${error.message}`);
      } else {
        this.logger.log('ERC721 NFT stored in database successfully');
      }
    } catch (error) {
      this.logger.error(`Database error: ${error.message}`);
    }
  }

  // Utility method to get contract addresses
  getContractAddresses(): ContractAddresses {
    return this.contractAddresses;
  }
}
