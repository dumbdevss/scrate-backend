import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get overall platform analytics' })
  @ApiQuery({ name: 'startDate', required: false, example: '2024-01-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2024-12-31' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  async getOverallAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getOverallAnalytics(startDate, endDate);
  }

  @Get('ipnfts')
  @ApiOperation({ summary: 'Get IP-NFT specific analytics' })
  @ApiResponse({ status: 200, description: 'IP-NFT analytics retrieved successfully' })
  async getIPNFTAnalytics() {
    return this.analyticsService.getIPNFTAnalytics();
  }

  @Get('marketplace')
  @ApiOperation({ summary: 'Get marketplace analytics' })
  @ApiResponse({ status: 200, description: 'Marketplace analytics retrieved successfully' })
  async getMarketplaceAnalytics() {
    return this.analyticsService.getMarketplaceAnalytics();
  }

  @Get('escrow')
  @ApiOperation({ summary: 'Get escrow analytics' })
  @ApiResponse({ status: 200, description: 'Escrow analytics retrieved successfully' })
  async getEscrowAnalytics() {
    return this.analyticsService.getEscrowAnalytics();
  }

  @Get('users')
  @ApiOperation({ summary: 'Get user analytics' })
  @ApiResponse({ status: 200, description: 'User analytics retrieved successfully' })
  async getUserAnalytics() {
    return this.analyticsService.getUserAnalytics();
  }

  @Get('historical')
  @ApiOperation({ summary: 'Get historical analytics data' })
  @ApiQuery({ name: 'days', required: false, example: 30, description: 'Number of days to look back' })
  @ApiResponse({ status: 200, description: 'Historical data retrieved successfully' })
  async getHistoricalData(@Query('days') days: string = '30') {
    return this.analyticsService.getHistoricalData(parseInt(days));
  }
}
