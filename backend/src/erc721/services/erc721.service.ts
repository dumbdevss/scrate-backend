import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import PinataSDK from '@pinata/sdk';

// Import contract ABIs (these would be generated from your compiled contracts)
import * as IPNFTAbi from '../../../smart-contracts/artifacts/contracts/ipNft.sol/IPNFT.json';
import * as MarketplaceAbi from '../../../smart-contracts/artifacts/contracts/IPNFTMarketplace.sol/IPNFTMarketplace.json';
import * as EscrowAbi from '../../../smart-contracts/artifacts/contracts/escrow.sol/IPNFTEscrow.json';

export interface ContractAddresses {
  ipnft: string;
  marketplace: string;
  escrow: string;
}

export interface MintResult {
  tokenId: string;
  transactionHash: string;
  contractAddress: string;
}

@Injectable()
export class ERC721Service {
  private readonly logger = new Logger(ERC721Service.name);
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private supabase: SupabaseClient;
  private pinata: PinataSDK;
  
  // Contract instances
  private ipnftContract: ethers.Contract;
  private marketplaceContract: ethers.Contract;
  private escrowContract: ethers.Contract;
  
  private contractAddresses: ContractAddresses;

  constructor(private configService: ConfigService) {
    this.initializeProvider();
    this.initializeContracts();
    this.initializeSupabase();
    this.initializePinata();
  }

  private initializeProvider() {
    const rpcUrl = this.configService.get<string>('RPC_URL');
    const privateKey = this.configService.get<string>('PRIVATE_KEY');

    if (!rpcUrl || !privateKey) {
      throw new Error('RPC_URL and PRIVATE_KEY must be provided in environment variables');
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    
    this.logger.log('ERC721 provider and wallet initialized');
  }

  private initializeContracts() {
    this.contractAddresses = {
      ipnft: this.configService.get<string>('IPNFT_CONTRACT_ADDRESS', ''),
      marketplace: this.configService.get<string>('MARKETPLACE_CONTRACT_ADDRESS', ''),
      escrow: this.configService.get<string>('ESCROW_CONTRACT_ADDRESS', ''),
    };

    if (this.contractAddresses.ipnft) {
      this.ipnftContract = new ethers.Contract(
        this.contractAddresses.ipnft,
        IPNFTAbi.abi,
        this.wallet
      );
      this.logger.log(`IPNFT contract initialized at ${this.contractAddresses.ipnft}`);
    }

    if (this.contractAddresses.marketplace) {
      this.marketplaceContract = new ethers.Contract(
        this.contractAddresses.marketplace,
        MarketplaceAbi.abi,
        this.wallet
      );
      this.logger.log(`Marketplace contract initialized at ${this.contractAddresses.marketplace}`);
    }

    if (this.contractAddresses.escrow) {
      this.escrowContract = new ethers.Contract(
        this.contractAddresses.escrow,
        EscrowAbi.abi,
        this.wallet
      );
      this.logger.log(`Escrow contract initialized at ${this.contractAddresses.escrow}`);
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
    const pinataJwt = this.configService.get<string>('PINATA_JWT');
    const pinataGateway = this.configService.get<string>('PINATA_GATEWAY', 'violet-patient-squid-248.mypinata.cloud');

    if (!pinataJwt) {
      throw new Error('PINATA_JWT must be provided in environment variables');
    }

    this.pinata = new PinataSDK({
      pinataJwt,
      pinataGateway,
    });

    this.logger.log('Pinata client initialized successfully');
  }

  // IP-NFT Functions
  async mintIPNFT(
    to: string,
    title: string,
    description: string,
    ipType: string,
    uri: string,
    tags: string[],
    contentHash: string
  ): Promise<MintResult> {
    try {
      if (!this.ipnftContract) {
        throw new BadRequestException('IPNFT contract not initialized');
      }

      this.logger.log(`Minting IP-NFT: ${title} to ${to}`);

      // Convert contentHash to bytes32 if it's a string
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
      const mintEvent = receipt.logs.find(log => {
        try {
          const parsed = this.ipnftContract.interface.parseLog(log);
          return parsed.name === 'IPNFTMinted';
        } catch {
          return false;
        }
      });

      let tokenId = '0';
      if (mintEvent) {
        const parsed = this.ipnftContract.interface.parseLog(mintEvent);
        tokenId = parsed.args.tokenId.toString();
      }

      this.logger.log(`IP-NFT minted successfully. Token ID: ${tokenId}, Transaction: ${tx.hash}`);

      // Store in database
      await this.storeNFTInDatabase({
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
      this.logger.error(`Failed to mint IP-NFT: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to mint IP-NFT: ${error.message}`);
    }
  }

  async getIPNFTInfo(tokenId: string) {
    try {
      if (!this.ipnftContract) {
        throw new BadRequestException('IPNFT contract not initialized');
      }

      const [owner, tokenURI, metadata] = await Promise.all([
        this.ipnftContract.ownerOf(tokenId),
        this.ipnftContract.tokenURI(tokenId),
        this.ipnftContract.ipMetadata(tokenId),
      ]);

      return {
        tokenId,
        owner,
        tokenURI,
        metadata: {
          title: metadata.title,
          description: metadata.description,
          ipType: metadata.ipType,
          creator: metadata.creator,
          createdAt: metadata.createdAt.toString(),
          tags: metadata.tags,
          contentHash: metadata.contentHash,
          isActive: metadata.isActive,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get IP-NFT info: ${error.message}`);
      throw new BadRequestException(`Failed to get IP-NFT info: ${error.message}`);
    }
  }

  async getTotalSupply(): Promise<number> {
    try {
      if (!this.ipnftContract) {
        throw new BadRequestException('IPNFT contract not initialized');
      }

      const totalSupply = await this.ipnftContract.totalSupply();
      return parseInt(totalSupply.toString());
    } catch (error) {
      this.logger.error(`Failed to get total supply: ${error.message}`);
      throw new BadRequestException(`Failed to get total supply: ${error.message}`);
    }
  }

  // Marketplace Functions
  async listItem(tokenAddress: string, tokenId: string, price: string): Promise<string> {
    try {
      if (!this.marketplaceContract) {
        throw new BadRequestException('Marketplace contract not initialized');
      }

      this.logger.log(`Listing item: ${tokenAddress}:${tokenId} for ${price} wei`);

      const tx = await this.marketplaceContract.listItem(
        tokenAddress,
        tokenId,
        ethers.parseEther(price)
      );

      await tx.wait();
      this.logger.log(`Item listed successfully. Transaction: ${tx.hash}`);

      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to list item: ${error.message}`);
      throw new BadRequestException(`Failed to list item: ${error.message}`);
    }
  }

  async purchaseItem(listingId: string, paymentAmount: string): Promise<string> {
    try {
      if (!this.marketplaceContract) {
        throw new BadRequestException('Marketplace contract not initialized');
      }

      const tx = await this.marketplaceContract.purchaseItem(listingId, {
        value: ethers.parseEther(paymentAmount)
      });

      await tx.wait();
      this.logger.log(`Item purchased successfully. Transaction: ${tx.hash}`);

      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to purchase item: ${error.message}`);
      throw new BadRequestException(`Failed to purchase item: ${error.message}`);
    }
  }

  // Escrow Functions
  async createEscrow(
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
      if (!this.escrowContract) {
        throw new BadRequestException('Escrow contract not initialized');
      }

      // Convert expected hashes to bytes32
      const expectedHashesBytes32 = expectedHashes.map(hash => 
        ethers.keccak256(ethers.toUtf8Bytes(hash))
      );

      const tx = await this.escrowContract.createEscrow(
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
      this.logger.log(`Escrow created successfully. Transaction: ${tx.hash}`);

      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to create escrow: ${error.message}`);
      throw new BadRequestException(`Failed to create escrow: ${error.message}`);
    }
  }

  // Utility Functions
  async uploadNFTMetadata(metadata: any): Promise<string> {
    try {
      const result = await this.pinata.pinJSONToIPFS(metadata);
      const metadataUrl = `https://${this.configService.get('PINATA_GATEWAY')}/ipfs/${result.IpfsHash}`;
      this.logger.log(`Metadata uploaded to IPFS: ${metadataUrl}`);
      return metadataUrl;
    } catch (error) {
      this.logger.error(`Failed to upload metadata: ${error.message}`);
      throw new BadRequestException(`Failed to upload metadata: ${error.message}`);
    }
  }

  private async storeNFTInDatabase(nftData: any) {
    try {
      const { data, error } = await this.supabase.from('ipnfts').insert({
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
        this.logger.error(`Failed to store NFT in database: ${error.message}`);
      } else {
        this.logger.log('NFT stored in database successfully');
      }
    } catch (error) {
      this.logger.error(`Database error: ${error.message}`);
    }
  }

  // Contract address getters
  getContractAddresses(): ContractAddresses {
    return this.contractAddresses;
  }
}
