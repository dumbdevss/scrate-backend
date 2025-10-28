import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private supabaseService: SupabaseService) {}

  async getOverallAnalytics(startDate?: string, endDate?: string) {
    try {
      const analyticsData = await this.supabaseService.getAnalyticsData(startDate, endDate);
      
      return {
        ...analyticsData,
        period: {
          start: startDate || new Date().toISOString().split('T')[0],
          end: endDate || new Date().toISOString().split('T')[0],
        },
      };
    } catch (error) {
      this.logger.error('Failed to get overall analytics', error);
      throw error;
    }
  }

  async getIPNFTAnalytics() {
    try {
      const { data: ipnfts } = await this.supabaseService.getSupabaseClient()
        .from('ipnfts')
        .select('*');

      // Group by IP type
      const byType = ipnfts?.reduce((acc, ipnft) => {
        acc[ipnft.ip_type] = (acc[ipnft.ip_type] || 0) + 1;
        return acc;
      }, {}) || {};

      // Group by creator
      const byCreator = ipnfts?.reduce((acc, ipnft) => {
        acc[ipnft.creator_address] = (acc[ipnft.creator_address] || 0) + 1;
        return acc;
      }, {}) || {};

      // Monthly creation stats
      const monthlyStats = ipnfts?.reduce((acc, ipnft) => {
        const month = new Date(ipnft.created_at).toISOString().substring(0, 7);
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {}) || {};

      return {
        total: ipnfts?.length || 0,
        byType,
        byCreator,
        monthlyStats,
        topCreators: Object.entries(byCreator)
          .sort(([,a], [,b]) => (b as number) - (a as number))
          .slice(0, 10),
      };
    } catch (error) {
      this.logger.error('Failed to get IPNFT analytics', error);
      throw error;
    }
  }

  async getMarketplaceAnalytics() {
    try {
      const { data: transactions } = await this.supabaseService.getSupabaseClient()
        .from('marketplace_transactions')
        .select('*');

      const sales = transactions?.filter(t => t.transaction_type === 'sale') || [];
      const listings = transactions?.filter(t => t.transaction_type === 'listing') || [];
      const auctions = transactions?.filter(t => t.transaction_type === 'auction_created') || [];

      const totalVolume = sales.reduce((sum, sale) => sum + parseFloat(sale.price || '0'), 0);
      const averagePrice = sales.length > 0 ? totalVolume / sales.length : 0;

      // Monthly volume
      const monthlyVolume = sales.reduce((acc, sale) => {
        const month = new Date(sale.created_at).toISOString().substring(0, 7);
        acc[month] = (acc[month] || 0) + parseFloat(sale.price || '0');
        return acc;
      }, {});

      return {
        totalTransactions: transactions?.length || 0,
        totalSales: sales.length,
        totalListings: listings.length,
        totalAuctions: auctions.length,
        totalVolume,
        averagePrice,
        monthlyVolume,
        conversionRate: listings.length > 0 ? (sales.length / listings.length) * 100 : 0,
      };
    } catch (error) {
      this.logger.error('Failed to get marketplace analytics', error);
      throw error;
    }
  }

  async getEscrowAnalytics() {
    try {
      const { data: transactions } = await this.supabaseService.getSupabaseClient()
        .from('escrow_transactions')
        .select('*');

      const created = transactions?.filter(t => t.transaction_type === 'created') || [];
      const completed = transactions?.filter(t => t.transaction_type === 'completed') || [];
      const disputed = transactions?.filter(t => t.transaction_type === 'disputed') || [];

      const completionRate = created.length > 0 ? (completed.length / created.length) * 100 : 0;
      const disputeRate = created.length > 0 ? (disputed.length / created.length) * 100 : 0;

      // Average escrow duration (simplified calculation)
      const averageDuration = completed.length > 0 ? 
        completed.reduce((sum, escrow) => {
          const created_at = new Date(escrow.created_at);
          const completed_at = new Date(); // This would need to be tracked properly
          return sum + (completed_at.getTime() - created_at.getTime());
        }, 0) / completed.length / (1000 * 60 * 60 * 24) : 0; // Convert to days

      return {
        totalEscrows: created.length,
        completedEscrows: completed.length,
        activeEscrows: created.length - completed.length,
        disputedEscrows: disputed.length,
        completionRate,
        disputeRate,
        averageDurationDays: Math.round(averageDuration),
      };
    } catch (error) {
      this.logger.error('Failed to get escrow analytics', error);
      throw error;
    }
  }

  async getUserAnalytics() {
    try {
      // Get unique users from all tables
      const { data: ipnfts } = await this.supabaseService.getSupabaseClient()
        .from('ipnfts')
        .select('creator_address, owner_address');

      const { data: marketplaceTransactions } = await this.supabaseService.getSupabaseClient()
        .from('marketplace_transactions')
        .select('seller_address, buyer_address');

      const { data: escrowTransactions } = await this.supabaseService.getSupabaseClient()
        .from('escrow_transactions')
        .select('seller_address, buyer_address');

      const allUsers = new Set();
      
      ipnfts?.forEach(ipnft => {
        if (ipnft.creator_address) allUsers.add(ipnft.creator_address);
        if (ipnft.owner_address) allUsers.add(ipnft.owner_address);
      });

      marketplaceTransactions?.forEach(tx => {
        if (tx.seller_address) allUsers.add(tx.seller_address);
        if (tx.buyer_address) allUsers.add(tx.buyer_address);
      });

      escrowTransactions?.forEach(tx => {
        if (tx.seller_address) allUsers.add(tx.seller_address);
        if (tx.buyer_address) allUsers.add(tx.buyer_address);
      });

      return {
        totalUsers: allUsers.size,
        creators: ipnfts?.map(i => i.creator_address).filter((v, i, a) => a.indexOf(v) === i).length || 0,
        traders: marketplaceTransactions?.map(t => [t.seller_address, t.buyer_address]).flat()
          .filter((v, i, a) => v && a.indexOf(v) === i).length || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get user analytics', error);
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async createDailySnapshot() {
    try {
      this.logger.log('Creating daily analytics snapshot');
      
      const analyticsData = await this.supabaseService.getAnalyticsData();
      await this.supabaseService.saveAnalyticsSnapshot(analyticsData);
      
      this.logger.log('Daily analytics snapshot created successfully');
    } catch (error) {
      this.logger.error('Failed to create daily analytics snapshot', error);
    }
  }

  async getHistoricalData(days: number = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      const { data: snapshots } = await this.supabaseService.getSupabaseClient()
        .from('analytics_snapshots')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      return {
        period: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
          days,
        },
        data: snapshots || [],
      };
    } catch (error) {
      this.logger.error('Failed to get historical data', error);
      throw error;
    }
  }
}
