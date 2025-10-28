import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { EscrowService } from './escrow.service';

@ApiTags('escrow')
@Controller('escrow')
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create escrow agreement' })
  @ApiResponse({ status: 201, description: 'Escrow created successfully' })
  async createEscrow(@Body() escrowData: {
    tokenAddress: string;
    tokenId: string;
    buyer: string;
    price: string;
    deadline: number;
    sellerAddress: string;
  }) {
    return this.escrowService.createEscrow(
      escrowData.tokenAddress,
      escrowData.tokenId,
      escrowData.buyer,
      escrowData.price,
      escrowData.deadline,
      escrowData.sellerAddress,
    );
  }

  @Post(':escrowId/verify')
  @ApiOperation({ summary: 'Submit verification for escrow' })
  @ApiParam({ name: 'escrowId', description: 'Escrow ID' })
  @ApiResponse({ status: 200, description: 'Verification submitted successfully' })
  async submitVerification(
    @Param('escrowId') escrowId: string,
    @Body() verificationData: {
      verificationType: number;
      documentHash: string;
      description: string;
      submitterAddress: string;
      tokenId: string;
    },
  ) {
    return this.escrowService.submitVerification(
      escrowId,
      verificationData.verificationType,
      verificationData.documentHash,
      verificationData.description,
      verificationData.submitterAddress,
      verificationData.tokenId,
    );
  }

  @Post(':escrowId/complete')
  @ApiOperation({ summary: 'Complete escrow agreement' })
  @ApiParam({ name: 'escrowId', description: 'Escrow ID' })
  @ApiResponse({ status: 200, description: 'Escrow completed successfully' })
  async completeEscrow(
    @Param('escrowId') escrowId: string,
    @Body() completionData: {
      tokenId: string;
      sellerAddress: string;
      buyerAddress: string;
    },
  ) {
    return this.escrowService.completeEscrow(
      escrowId,
      completionData.tokenId,
      completionData.sellerAddress,
      completionData.buyerAddress,
    );
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get escrow transactions' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiResponse({ status: 200, description: 'Transactions retrieved successfully' })
  async getTransactions(
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ) {
    return this.escrowService.getEscrowTransactions(
      parseInt(limit),
      parseInt(offset),
    );
  }

  @Get(':escrowId/transactions')
  @ApiOperation({ summary: 'Get transactions for specific escrow' })
  @ApiParam({ name: 'escrowId', description: 'Escrow ID' })
  @ApiResponse({ status: 200, description: 'Escrow transactions retrieved successfully' })
  async getTransactionsByEscrowId(@Param('escrowId') escrowId: string) {
    return this.escrowService.getEscrowTransactionsByEscrowId(escrowId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get escrow statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStats() {
    return this.escrowService.getEscrowStats();
  }
}
