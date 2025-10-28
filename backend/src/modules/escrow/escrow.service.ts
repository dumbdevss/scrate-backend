import { Injectable, Logger } from '@nestjs/common';
import { ContractService } from '../hedera/contract.service';
import { SupabaseService, EscrowTransaction } from '../supabase/supabase.service';

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    private contractService: ContractService,
    private supabaseService: SupabaseService,
  ) {}

  async createEscrow(
    tokenAddress: string,
    tokenId: string,
    buyer: string,
    price: string,
    deadline: number,
    sellerAddress: string,
  ) {
    try {
      this.logger.log(`Creating escrow for NFT: ${tokenId}`);

      const escrowResult = await this.contractService.createEscrow(
        tokenAddress,
        tokenId,
        buyer,
        price,
        deadline,
      );

      const transactionData: EscrowTransaction = {
        escrow_id: escrowResult.escrowId,
        transaction_type: 'created',
        token_id: tokenId,
        seller_address: sellerAddress,
        buyer_address: buyer,
        price: price,
        deadline: new Date(deadline * 1000).toISOString(),
        status: 'Active',
        transaction_hash: escrowResult.transactionHash,
        block_number: escrowResult.blockNumber,
        gas_used: escrowResult.gasUsed,
      };

      const savedTransaction = await this.supabaseService.createEscrowTransaction(transactionData);

      this.logger.log(`Escrow created successfully: ${escrowResult.escrowId}`);

      return {
        escrowId: escrowResult.escrowId,
        transactionHash: escrowResult.transactionHash,
        blockNumber: escrowResult.blockNumber,
        gasUsed: escrowResult.gasUsed,
        transaction: savedTransaction,
      };
    } catch (error) {
      this.logger.error('Failed to create escrow', error);
      throw error;
    }
  }

  async submitVerification(
    escrowId: string,
    verificationType: number,
    documentHash: string,
    description: string,
    submitterAddress: string,
    tokenId: string,
  ) {
    try {
      this.logger.log(`Submitting verification for escrow: ${escrowId}`);

      const verificationResult = await this.contractService.submitVerification(
        escrowId,
        verificationType,
        documentHash,
        description,
      );

      const transactionData: EscrowTransaction = {
        escrow_id: escrowId,
        transaction_type: 'verification_submitted',
        token_id: tokenId,
        seller_address: submitterAddress,
        buyer_address: '',
        price: '0',
        deadline: new Date().toISOString(),
        status: 'VerificationSubmitted',
        verification_type: verificationType.toString(),
        document_hash: documentHash,
        transaction_hash: verificationResult.transactionHash,
        block_number: verificationResult.blockNumber,
        gas_used: verificationResult.gasUsed,
      };

      const savedTransaction = await this.supabaseService.createEscrowTransaction(transactionData);

      this.logger.log(`Verification submitted for escrow: ${escrowId}`);

      return {
        escrowId,
        verificationType,
        documentHash,
        transactionHash: verificationResult.transactionHash,
        blockNumber: verificationResult.blockNumber,
        gasUsed: verificationResult.gasUsed,
        transaction: savedTransaction,
      };
    } catch (error) {
      this.logger.error('Failed to submit verification', error);
      throw error;
    }
  }

  async completeEscrow(
    escrowId: string,
    tokenId: string,
    sellerAddress: string,
    buyerAddress: string,
  ) {
    try {
      this.logger.log(`Completing escrow: ${escrowId}`);

      const completionResult = await this.contractService.completeEscrow(escrowId);

      const transactionData: EscrowTransaction = {
        escrow_id: escrowId,
        transaction_type: 'completed',
        token_id: tokenId,
        seller_address: sellerAddress,
        buyer_address: buyerAddress,
        price: '0',
        deadline: new Date().toISOString(),
        status: 'Completed',
        transaction_hash: completionResult.transactionHash,
        block_number: completionResult.blockNumber,
        gas_used: completionResult.gasUsed,
      };

      const savedTransaction = await this.supabaseService.createEscrowTransaction(transactionData);

      this.logger.log(`Escrow completed successfully: ${escrowId}`);

      return {
        escrowId,
        transactionHash: completionResult.transactionHash,
        blockNumber: completionResult.blockNumber,
        gasUsed: completionResult.gasUsed,
        transaction: savedTransaction,
      };
    } catch (error) {
      this.logger.error('Failed to complete escrow', error);
      throw error;
    }
  }

  async getEscrowTransactions(limit: number = 50, offset: number = 0) {
    try {
      const transactions = await this.supabaseService.getEscrowTransactions(limit, offset);
      
      return {
        data: transactions,
        pagination: {
          limit,
          offset,
          total: transactions.length,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get escrow transactions', error);
      throw error;
    }
  }

  async getEscrowTransactionsByEscrowId(escrowId: string) {
    try {
      const transactions = await this.supabaseService.getEscrowTransactionsByEscrowId(escrowId);
      
      return {
        escrowId,
        transactions,
        count: transactions.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get transactions for escrow ${escrowId}`, error);
      throw error;
    }
  }

  async getEscrowStats() {
    try {
      const { data: allTransactions } = await this.supabaseService.getSupabaseClient()
        .from('escrow_transactions')
        .select('*');

      const stats = {
        totalEscrows: allTransactions?.filter(t => t.transaction_type === 'created').length || 0,
        completedEscrows: allTransactions?.filter(t => t.transaction_type === 'completed').length || 0,
        activeEscrows: allTransactions?.filter(t => t.transaction_type === 'created').length - 
                      allTransactions?.filter(t => t.transaction_type === 'completed').length || 0,
        totalVerifications: allTransactions?.filter(t => t.transaction_type === 'verification_submitted').length || 0,
        disputedEscrows: allTransactions?.filter(t => t.transaction_type === 'disputed').length || 0,
      };

      return stats;
    } catch (error) {
      this.logger.error('Failed to get escrow stats', error);
      throw error;
    }
  }
}
