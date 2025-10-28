import { Injectable, Logger } from '@nestjs/common';
import { ContractService } from '../hedera/contract.service';
import { SupabaseService, MarketplaceTransaction } from '../supabase/supabase.service';

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    private contractService: ContractService,
    private supabaseService: SupabaseService,
  ) {}

  async listForSale(
    tokenAddress: string,
    tokenId: string,
    price: string,
    sellerAddress: string,
  ) {
    try {
      this.logger.log(`Listing NFT for sale: ${tokenId} at ${price} ETH`);

      // List on smart contract
      const listResult = await this.contractService.listForSale(
        tokenAddress,
        tokenId,
        price,
      );

      // Log transaction in Supabase
      const transactionData: MarketplaceTransaction = {
        transaction_type: 'listing',
        token_id: tokenId,
        listing_id: listResult.listingId,
        seller_address: sellerAddress,
        price: price,
        transaction_hash: listResult.transactionHash,
        block_number: listResult.blockNumber,
        gas_used: listResult.gasUsed,
      };

      const savedTransaction = await this.supabaseService.createMarketplaceTransaction(transactionData);

      this.logger.log(`NFT listed successfully: ${listResult.listingId}`);

      return {
        listingId: listResult.listingId,
        transactionHash: listResult.transactionHash,
        blockNumber: listResult.blockNumber,
        gasUsed: listResult.gasUsed,
        transaction: savedTransaction,
      };
    } catch (error) {
      this.logger.error('Failed to list NFT for sale', error);
      throw error;
    }
  }

  async createAuction(
    tokenAddress: string,
    tokenId: string,
    startingPrice: string,
    duration: number,
    sellerAddress: string,
  ) {
    try {
      this.logger.log(`Creating auction for NFT: ${tokenId} starting at ${startingPrice} ETH`);

      // Create auction on smart contract
      const auctionResult = await this.contractService.createAuction(
        tokenAddress,
        tokenId,
        startingPrice,
        duration,
      );

      // Log transaction in Supabase
      const transactionData: MarketplaceTransaction = {
        transaction_type: 'auction_created',
        token_id: tokenId,
        auction_id: auctionResult.auctionId,
        seller_address: sellerAddress,
        price: startingPrice,
        transaction_hash: auctionResult.transactionHash,
        block_number: auctionResult.blockNumber,
        gas_used: auctionResult.gasUsed,
      };

      const savedTransaction = await this.supabaseService.createMarketplaceTransaction(transactionData);

      this.logger.log(`Auction created successfully: ${auctionResult.auctionId}`);

      return {
        auctionId: auctionResult.auctionId,
        transactionHash: auctionResult.transactionHash,
        blockNumber: auctionResult.blockNumber,
        gasUsed: auctionResult.gasUsed,
        transaction: savedTransaction,
      };
    } catch (error) {
      this.logger.error('Failed to create auction', error);
      throw error;
    }
  }

  async buyNow(
    listingId: string,
    price: string,
    buyerAddress: string,
    tokenId: string,
  ) {
    try {
      this.logger.log(`Buying NFT: listing ${listingId} for ${price} ETH`);

      // Execute purchase on smart contract
      const buyResult = await this.contractService.buyNow(listingId, price);

      // Log transaction in Supabase
      const transactionData: MarketplaceTransaction = {
        transaction_type: 'sale',
        token_id: tokenId,
        listing_id: listingId,
        seller_address: '', // This would need to be fetched from the listing
        buyer_address: buyerAddress,
        price: price,
        transaction_hash: buyResult.transactionHash,
        block_number: buyResult.blockNumber,
        gas_used: buyResult.gasUsed,
      };

      const savedTransaction = await this.supabaseService.createMarketplaceTransaction(transactionData);

      this.logger.log(`NFT purchased successfully: ${listingId}`);

      return {
        transactionHash: buyResult.transactionHash,
        blockNumber: buyResult.blockNumber,
        gasUsed: buyResult.gasUsed,
        transaction: savedTransaction,
      };
    } catch (error) {
      this.logger.error('Failed to buy NFT', error);
      throw error;
    }
  }

  async placeBid(
    auctionId: string,
    bidAmount: string,
    bidderAddress: string,
    tokenId: string,
  ) {
    try {
      this.logger.log(`Placing bid on auction: ${auctionId} for ${bidAmount} ETH`);

      // This would require implementing placeBid in ContractService
      // For now, we'll log the transaction
      const transactionData: MarketplaceTransaction = {
        transaction_type: 'bid_placed',
        token_id: tokenId,
        auction_id: auctionId,
        seller_address: '', // Would need to be fetched from auction
        buyer_address: bidderAddress,
        price: bidAmount,
        transaction_hash: '', // Would come from smart contract
        block_number: 0, // Would come from smart contract
        gas_used: '0', // Would come from smart contract
      };

      const savedTransaction = await this.supabaseService.createMarketplaceTransaction(transactionData);

      this.logger.log(`Bid placed successfully on auction: ${auctionId}`);

      return {
        auctionId,
        bidAmount,
        bidderAddress,
        transaction: savedTransaction,
      };
    } catch (error) {
      this.logger.error('Failed to place bid', error);
      throw error;
    }
  }

  async endAuction(
    auctionId: string,
    winnerAddress: string,
    finalPrice: string,
    tokenId: string,
  ) {
    try {
      this.logger.log(`Ending auction: ${auctionId}`);

      // Log transaction in Supabase
      const transactionData: MarketplaceTransaction = {
        transaction_type: 'auction_ended',
        token_id: tokenId,
        auction_id: auctionId,
        seller_address: '', // Would need to be fetched from auction
        buyer_address: winnerAddress,
        price: finalPrice,
        transaction_hash: '', // Would come from smart contract
        block_number: 0, // Would come from smart contract
        gas_used: '0', // Would come from smart contract
      };

      const savedTransaction = await this.supabaseService.createMarketplaceTransaction(transactionData);

      this.logger.log(`Auction ended successfully: ${auctionId}`);

      return {
        auctionId,
        winnerAddress,
        finalPrice,
        transaction: savedTransaction,
      };
    } catch (error) {
      this.logger.error('Failed to end auction', error);
      throw error;
    }
  }

  async getMarketplaceTransactions(limit: number = 50, offset: number = 0) {
    try {
      const transactions = await this.supabaseService.getMarketplaceTransactions(limit, offset);
      
      return {
        data: transactions,
        pagination: {
          limit,
          offset,
          total: transactions.length,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get marketplace transactions', error);
      throw error;
    }
  }

  async getTransactionsByToken(tokenId: string) {
    try {
      const transactions = await this.supabaseService.getMarketplaceTransactionsByToken(tokenId);
      
      return {
        tokenId,
        transactions,
        count: transactions.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get transactions for token ${tokenId}`, error);
      throw error;
    }
  }

  async getMarketplaceStats() {
    try {
      const { data: allTransactions } = await this.supabaseService.getSupabaseClient()
        .from('marketplace_transactions')
        .select('*');

      const stats = {
        totalTransactions: allTransactions?.length || 0,
        totalListings: allTransactions?.filter(t => t.transaction_type === 'listing').length || 0,
        totalSales: allTransactions?.filter(t => t.transaction_type === 'sale').length || 0,
        totalAuctions: allTransactions?.filter(t => t.transaction_type === 'auction_created').length || 0,
        totalBids: allTransactions?.filter(t => t.transaction_type === 'bid_placed').length || 0,
        totalVolume: allTransactions
          ?.filter(t => t.transaction_type === 'sale')
          .reduce((sum, t) => sum + parseFloat(t.price || '0'), 0) || 0,
      };

      return stats;
    } catch (error) {
      this.logger.error('Failed to get marketplace stats', error);
      throw error;
    }
  }
}
