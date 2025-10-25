import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
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

@Injectable()
export class HederaService {
  private readonly logger = new Logger(HederaService.name);
  private client: Client;
  private operatorId: AccountId;
  private operatorKey: PrivateKey;
  private supabase: SupabaseClient;
  private ipnftCollectionId: string;

  constructor(private configService: ConfigService) {
    this.initializeClient();
    this.initializeSupabase();
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

      const metadataBytes = Buffer.from(JSON.stringify(metadata));

      const mintTx = new TokenMintTransaction()
        .setTokenId(tokenId)
        .setMetadata([metadataBytes])
        .setMaxTransactionFee(new Hbar(20));

      const mintTxSubmit = await mintTx.execute(this.client);
      const mintRx = await mintTxSubmit.getReceipt(this.client);
      const serialNumbers = mintRx.serials;

      if (!serialNumbers || serialNumbers.length === 0) {
        throw new BadRequestException('Failed to mint IP-NFT - no serial numbers returned');
      }

      // Transfer to recipient if different from operator
      if (recipientId.toString() !== this.operatorId.toString()) {
        const transferTx = new TransferTransaction()
          .addNftTransfer(tokenId, serialNumbers[0], this.operatorId, recipientId)
          .setMaxTransactionFee(new Hbar(10));

        await transferTx.execute(this.client);
      }

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
        metadata: JSON.stringify(metadata),
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

      const tokenId = AccountId.fromString(this.ipnftCollectionId);
      const nftId = new NftId(tokenId, serialNumber);

      const nftInfo = await new TokenNftInfoQuery()
        .setNftId(nftId)
        .execute(this.client);

      return {
        tokenId: this.ipnftCollectionId,
        serialNumber: serialNumber,
        accountId: nftInfo[0]?.accountId?.toString() || '',
        metadata: Buffer.from(nftInfo[0]?.metadata || []).toString(),
        createdTimestamp: nftInfo[0]?.creationTime?.toDate().toISOString() || '',
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
}
