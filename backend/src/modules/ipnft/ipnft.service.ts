import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ContractService } from '../hedera/contract.service';
import { SupabaseService, IPNFTRecord } from '../supabase/supabase.service';
import { CreateIPNFTDto } from './dto/create-ipnft.dto';
import { ethers } from 'ethers';

@Injectable()
export class IpnftService {
  private readonly logger = new Logger(IpnftService.name);

  constructor(
    private contractService: ContractService,
    private supabaseService: SupabaseService,
  ) {}

  async mintIPNFT(createIPNFTDto: CreateIPNFTDto) {
    try {
      this.logger.log(`Minting IPNFT: ${createIPNFTDto.title}`);

      // Mint the NFT using the smart contract
      const mintResult = await this.contractService.mintIPNFT(
        createIPNFTDto.toAddress,
        createIPNFTDto.title,
        createIPNFTDto.description,
        createIPNFTDto.ipType,
        createIPNFTDto.tags,
        createIPNFTDto.contentHash,
        createIPNFTDto.metadataBytes,
        createIPNFTDto.schemaVersion || '1.0.0',
        createIPNFTDto.externalUrl || '',
        createIPNFTDto.imageUrl || '',
      );

      // Create record in Supabase
      const ipnftRecord: IPNFTRecord = {
        token_id: mintResult.tokenId,
        title: createIPNFTDto.title,
        description: createIPNFTDto.description,
        ip_type: createIPNFTDto.ipType,
        creator_address: createIPNFTDto.toAddress, // In this case, creator is the same as initial owner
        owner_address: createIPNFTDto.toAddress,
        content_hash: createIPNFTDto.contentHash,
        metadata_bytes: createIPNFTDto.metadataBytes,
        schema_version: createIPNFTDto.schemaVersion || '1.0.0',
        external_url: createIPNFTDto.externalUrl,
        image_url: createIPNFTDto.imageUrl,
        tags: createIPNFTDto.tags,
        transaction_hash: mintResult.transactionHash,
        block_number: mintResult.blockNumber,
        gas_used: mintResult.gasUsed,
      };

      const savedRecord = await this.supabaseService.createIPNFTRecord(ipnftRecord);

      this.logger.log(`IPNFT minted and recorded successfully: ${mintResult.tokenId}`);

      return {
        tokenId: mintResult.tokenId,
        transactionHash: mintResult.transactionHash,
        blockNumber: mintResult.blockNumber,
        gasUsed: mintResult.gasUsed,
        record: savedRecord,
      };
    } catch (error) {
      this.logger.error('Failed to mint IPNFT', error);
      throw error;
    }
  }

  async getIPNFT(tokenId: string) {
    try {
      // Get from database first (faster)
      const record = await this.supabaseService.getIPNFTRecord(tokenId);
      
      if (!record) {
        throw new NotFoundException(`IPNFT with token ID ${tokenId} not found`);
      }

      // Optionally get latest blockchain data for verification
      try {
        const blockchainData = await this.contractService.getIPNFTMetadata(tokenId);
        
        return {
          ...record,
          blockchain_data: blockchainData,
          verified: true,
        };
      } catch (blockchainError) {
        this.logger.warn(`Could not fetch blockchain data for token ${tokenId}`, blockchainError);
        
        return {
          ...record,
          blockchain_data: null,
          verified: false,
        };
      }
    } catch (error) {
      this.logger.error(`Failed to get IPNFT ${tokenId}`, error);
      throw error;
    }
  }

  async getAllIPNFTs(limit: number = 50, offset: number = 0) {
    try {
      const ipnfts = await this.supabaseService.getAllIPNFTs(limit, offset);
      
      return {
        data: ipnfts,
        pagination: {
          limit,
          offset,
          total: ipnfts.length,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get all IPNFTs', error);
      throw error;
    }
  }

  async getIPNFTsByCreator(creatorAddress: string, limit: number = 50, offset: number = 0) {
    try {
      // This would require a custom query in Supabase
      const { data, error } = await this.supabaseService.getSupabaseClient()
        .from('ipnfts')
        .select('*')
        .eq('creator_address', creatorAddress)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return {
        data: data || [],
        pagination: {
          limit,
          offset,
          total: data?.length || 0,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get IPNFTs by creator ${creatorAddress}`, error);
      throw error;
    }
  }

  async getIPNFTsByOwner(ownerAddress: string, limit: number = 50, offset: number = 0) {
    try {
      const { data, error } = await this.supabaseService.getSupabaseClient()
        .from('ipnfts')
        .select('*')
        .eq('owner_address', ownerAddress)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return {
        data: data || [],
        pagination: {
          limit,
          offset,
          total: data?.length || 0,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get IPNFTs by owner ${ownerAddress}`, error);
      throw error;
    }
  }

  async searchIPNFTs(query: string, limit: number = 50, offset: number = 0) {
    try {
      const { data, error } = await this.supabaseService.getSupabaseClient()
        .from('ipnfts')
        .select('*')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%,ip_type.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return {
        data: data || [],
        pagination: {
          limit,
          offset,
          total: data?.length || 0,
        },
        query,
      };
    } catch (error) {
      this.logger.error(`Failed to search IPNFTs with query: ${query}`, error);
      throw error;
    }
  }

  async updateIPNFTOwner(tokenId: string, newOwnerAddress: string) {
    try {
      await this.supabaseService.updateIPNFTOwner(tokenId, newOwnerAddress);
      
      this.logger.log(`IPNFT owner updated: ${tokenId} -> ${newOwnerAddress}`);
      
      return {
        tokenId,
        newOwnerAddress,
        updated: true,
      };
    } catch (error) {
      this.logger.error(`Failed to update IPNFT owner for ${tokenId}`, error);
      throw error;
    }
  }

  async validateMetadata(metadata: any): Promise<boolean> {
    try {
      // Basic metadata validation
      const requiredFields = ['title', 'description', 'ipType'];
      
      for (const field of requiredFields) {
        if (!metadata[field]) {
          return false;
        }
      }

      // Validate content hash format
      if (metadata.contentHash && !this.isValidHash(metadata.contentHash)) {
        return false;
      }

      // Validate URLs if provided
      if (metadata.externalUrl && !this.isValidUrl(metadata.externalUrl)) {
        return false;
      }

      if (metadata.imageUrl && !this.isValidUrl(metadata.imageUrl)) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to validate metadata', error);
      return false;
    }
  }

  private isValidHash(hash: string): boolean {
    // Basic hash validation (could be improved)
    return /^[a-fA-F0-9]{64}$/.test(hash) || /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(hash);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
