import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface IPNFTRecord {
  id?: string;
  token_id: string;
  title: string;
  description: string;
  ip_type: string;
  creator_address: string;
  owner_address: string;
  content_hash: string;
  metadata_bytes: string;
  schema_version: string;
  external_url?: string;
  image_url?: string;
  tags: string[];
  transaction_hash: string;
  block_number: number;
  gas_used: string;
  created_at?: string;
  updated_at?: string;
}

export interface MarketplaceTransaction {
  id?: string;
  transaction_type: 'listing' | 'sale' | 'auction_created' | 'bid_placed' | 'auction_ended';
  token_id: string;
  listing_id?: string;
  auction_id?: string;
  seller_address: string;
  buyer_address?: string;
  price: string;
  transaction_hash: string;
  block_number: number;
  gas_used: string;
  created_at?: string;
}

export interface EscrowTransaction {
  id?: string;
  escrow_id: string;
  transaction_type: 'created' | 'verification_submitted' | 'verification_approved' | 'completed' | 'disputed' | 'resolved';
  token_id: string;
  seller_address: string;
  buyer_address: string;
  price: string;
  deadline: string;
  status: string;
  verification_type?: string;
  document_hash?: string;
  transaction_hash: string;
  block_number: number;
  gas_used: string;
  created_at?: string;
}

export interface AnalyticsData {
  total_ipnfts: number;
  total_marketplace_transactions: number;
  total_escrow_transactions: number;
  total_volume: string;
  active_listings: number;
  active_auctions: number;
  active_escrows: number;
  date: string;
}

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeSupabase();
  }

  private async initializeSupabase() {
    try {
      const supabaseUrl = this.configService.get('supabase.url');
      const supabaseServiceKey = this.configService.get('supabase.serviceKey');

      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase URL and service key must be provided');
      }

      this.supabase = createClient(supabaseUrl, supabaseServiceKey);

      this.logger.log('Supabase client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Supabase client', error);
      throw error;
    }
  }

  // IPNFT Operations
  async createIPNFTRecord(ipnftData: IPNFTRecord): Promise<IPNFTRecord> {
    try {
      const { data, error } = await this.supabase
        .from('ipnfts')
        .insert([ipnftData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      this.logger.log(`IPNFT record created: ${data.token_id}`);
      return data;
    } catch (error) {
      this.logger.error('Failed to create IPNFT record', error);
      throw error;
    }
  }

  async getIPNFTRecord(tokenId: string): Promise<IPNFTRecord | null> {
    try {
      const { data, error } = await this.supabase
        .from('ipnfts')
        .select('*')
        .eq('token_id', tokenId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      this.logger.error('Failed to get IPNFT record', error);
      throw error;
    }
  }

  async updateIPNFTOwner(tokenId: string, newOwnerAddress: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('ipnfts')
        .update({ 
          owner_address: newOwnerAddress,
          updated_at: new Date().toISOString()
        })
        .eq('token_id', tokenId);

      if (error) {
        throw error;
      }

      this.logger.log(`IPNFT owner updated: ${tokenId} -> ${newOwnerAddress}`);
    } catch (error) {
      this.logger.error('Failed to update IPNFT owner', error);
      throw error;
    }
  }

  async getAllIPNFTs(limit: number = 100, offset: number = 0): Promise<IPNFTRecord[]> {
    try {
      const { data, error } = await this.supabase
        .from('ipnfts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Failed to get all IPNFTs', error);
      throw error;
    }
  }

  // Marketplace Operations
  async createMarketplaceTransaction(transactionData: MarketplaceTransaction): Promise<MarketplaceTransaction> {
    try {
      const { data, error } = await this.supabase
        .from('marketplace_transactions')
        .insert([transactionData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      this.logger.log(`Marketplace transaction recorded: ${data.transaction_type} - ${data.token_id}`);
      return data;
    } catch (error) {
      this.logger.error('Failed to create marketplace transaction', error);
      throw error;
    }
  }

  async getMarketplaceTransactions(limit: number = 100, offset: number = 0): Promise<MarketplaceTransaction[]> {
    try {
      const { data, error } = await this.supabase
        .from('marketplace_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Failed to get marketplace transactions', error);
      throw error;
    }
  }

  async getMarketplaceTransactionsByToken(tokenId: string): Promise<MarketplaceTransaction[]> {
    try {
      const { data, error } = await this.supabase
        .from('marketplace_transactions')
        .select('*')
        .eq('token_id', tokenId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Failed to get marketplace transactions by token', error);
      throw error;
    }
  }

  // Escrow Operations
  async createEscrowTransaction(transactionData: EscrowTransaction): Promise<EscrowTransaction> {
    try {
      const { data, error } = await this.supabase
        .from('escrow_transactions')
        .insert([transactionData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      this.logger.log(`Escrow transaction recorded: ${data.transaction_type} - ${data.escrow_id}`);
      return data;
    } catch (error) {
      this.logger.error('Failed to create escrow transaction', error);
      throw error;
    }
  }

  async getEscrowTransactions(limit: number = 100, offset: number = 0): Promise<EscrowTransaction[]> {
    try {
      const { data, error } = await this.supabase
        .from('escrow_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Failed to get escrow transactions', error);
      throw error;
    }
  }

  async getEscrowTransactionsByEscrowId(escrowId: string): Promise<EscrowTransaction[]> {
    try {
      const { data, error } = await this.supabase
        .from('escrow_transactions')
        .select('*')
        .eq('escrow_id', escrowId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Failed to get escrow transactions by escrow ID', error);
      throw error;
    }
  }

  // Analytics Operations
  async getAnalyticsData(startDate?: string, endDate?: string): Promise<AnalyticsData> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const start = startDate || today;
      const end = endDate || today;

      // Get total IPNFTs
      const { count: totalIPNFTs } = await this.supabase
        .from('ipnfts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', start)
        .lte('created_at', end + 'T23:59:59.999Z');

      // Get total marketplace transactions
      const { count: totalMarketplaceTransactions } = await this.supabase
        .from('marketplace_transactions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', start)
        .lte('created_at', end + 'T23:59:59.999Z');

      // Get total escrow transactions
      const { count: totalEscrowTransactions } = await this.supabase
        .from('escrow_transactions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', start)
        .lte('created_at', end + 'T23:59:59.999Z');

      // Calculate total volume from sales
      const { data: salesData } = await this.supabase
        .from('marketplace_transactions')
        .select('price')
        .eq('transaction_type', 'sale')
        .gte('created_at', start)
        .lte('created_at', end + 'T23:59:59.999Z');

      const totalVolume = salesData?.reduce((sum, transaction) => {
        return sum + parseFloat(transaction.price || '0');
      }, 0) || 0;

      // Get active listings count
      const { count: activeListings } = await this.supabase
        .from('marketplace_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('transaction_type', 'listing');

      // Get active auctions count
      const { count: activeAuctions } = await this.supabase
        .from('marketplace_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('transaction_type', 'auction_created');

      // Get active escrows count
      const { count: activeEscrows } = await this.supabase
        .from('escrow_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('transaction_type', 'created');

      return {
        total_ipnfts: totalIPNFTs || 0,
        total_marketplace_transactions: totalMarketplaceTransactions || 0,
        total_escrow_transactions: totalEscrowTransactions || 0,
        total_volume: totalVolume.toString(),
        active_listings: activeListings || 0,
        active_auctions: activeAuctions || 0,
        active_escrows: activeEscrows || 0,
        date: today,
      };
    } catch (error) {
      this.logger.error('Failed to get analytics data', error);
      throw error;
    }
  }

  async saveAnalyticsSnapshot(analyticsData: AnalyticsData): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('analytics_snapshots')
        .insert([analyticsData]);

      if (error) {
        throw error;
      }

      this.logger.log(`Analytics snapshot saved for ${analyticsData.date}`);
    } catch (error) {
      this.logger.error('Failed to save analytics snapshot', error);
      throw error;
    }
  }

  // Utility methods
  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }
}
