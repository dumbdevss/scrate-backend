import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { SmartContractService } from '../services/smart-contract.service';
import {
  CreateEscrowDto,
  SubmitVerificationDto,
  ApproveVerificationDto,
  RaiseDisputeDto,
  ResolveDisputeDto,
  TransactionResponseDto,
  EscrowDetailsDto
} from '../dto/smart-contract.dto';

@ApiTags('Escrow')
@Controller('api/escrow')
export class EscrowController {
  constructor(private readonly smartContractService: SmartContractService) {}

  // Escrow Management
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an escrow agreement for RWA IP-NFT' })
  @ApiResponse({ 
    status: 201, 
    description: 'Escrow created successfully',
    type: TransactionResponseDto
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createEscrow(@Body() escrowDto: CreateEscrowDto): Promise<TransactionResponseDto> {
    const txHash = await this.smartContractService.createEscrow(
      escrowDto.tokenContract,
      escrowDto.tokenId,
      escrowDto.buyer,
      escrowDto.completionDays,
      escrowDto.verificationTypes,
      escrowDto.verificationDescriptions,
      escrowDto.expectedHashes,
      escrowDto.verificationDeadlines,
      escrowDto.price
    );
    return {
      transactionHash: txHash,
      message: 'Escrow created successfully'
    };
  }

  @Get(':escrowId')
  @ApiOperation({ summary: 'Get escrow details' })
  @ApiParam({ name: 'escrowId', description: 'Escrow ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Escrow details retrieved successfully',
    type: EscrowDetailsDto
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async getEscrow(@Param('escrowId') escrowId: string): Promise<EscrowDetailsDto> {
    return this.smartContractService.getEscrow(parseInt(escrowId));
  }

  @Post(':escrowId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete an escrow transaction' })
  @ApiParam({ name: 'escrowId', description: 'Escrow ID to complete' })
  @ApiResponse({ 
    status: 200, 
    description: 'Escrow completed successfully',
    type: TransactionResponseDto
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async completeEscrow(@Param('escrowId') escrowId: string): Promise<TransactionResponseDto> {
    const txHash = await this.smartContractService.completeEscrow(parseInt(escrowId));
    return {
      transactionHash: txHash,
      message: 'Escrow completed successfully'
    };
  }

  // Verification Management
  @Post('verification/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit verification evidence for escrow' })
  @ApiResponse({ 
    status: 200, 
    description: 'Verification submitted successfully',
    type: TransactionResponseDto
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async submitVerification(@Body() verificationDto: SubmitVerificationDto): Promise<TransactionResponseDto> {
    const txHash = await this.smartContractService.submitVerification(
      verificationDto.escrowId,
      verificationDto.requirementIndex,
      verificationDto.evidence,
      verificationDto.documentHash
    );
    return {
      transactionHash: txHash,
      message: 'Verification submitted successfully'
    };
  }

  @Post('verification/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve verification evidence' })
  @ApiResponse({ 
    status: 200, 
    description: 'Verification approved successfully',
    type: TransactionResponseDto
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async approveVerification(@Body() approvalDto: ApproveVerificationDto): Promise<TransactionResponseDto> {
    const txHash = await this.smartContractService.approveVerification(
      approvalDto.escrowId,
      approvalDto.requirementIndex,
      approvalDto.comment
    );
    return {
      transactionHash: txHash,
      message: 'Verification approved successfully'
    };
  }

  // Dispute Management
  @Post('dispute/raise')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Raise a dispute for an escrow' })
  @ApiResponse({ 
    status: 200, 
    description: 'Dispute raised successfully',
    type: TransactionResponseDto
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async raiseDispute(@Body() disputeDto: RaiseDisputeDto): Promise<TransactionResponseDto> {
    const txHash = await this.smartContractService.raiseDispute(
      disputeDto.escrowId,
      disputeDto.reason
    );
    return {
      transactionHash: txHash,
      message: 'Dispute raised successfully'
    };
  }

  @Post('dispute/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve a dispute (admin only)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Dispute resolved successfully',
    type: TransactionResponseDto
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async resolveDispute(@Body() resolveDto: ResolveDisputeDto): Promise<TransactionResponseDto> {
    const txHash = await this.smartContractService.resolveDispute(
      resolveDto.escrowId,
      resolveDto.winner,
      resolveDto.resolution
    );
    return {
      transactionHash: txHash,
      message: 'Dispute resolved successfully'
    };
  }

  // Statistics
  @Get('stats/total')
  @ApiOperation({ summary: 'Get total number of escrows' })
  @ApiResponse({ 
    status: 200, 
    description: 'Total escrows retrieved successfully'
  })
  async getTotalEscrows(): Promise<{ totalEscrows: number }> {
    const total = await this.smartContractService.getTotalEscrows();
    return { totalEscrows: total };
  }
}
