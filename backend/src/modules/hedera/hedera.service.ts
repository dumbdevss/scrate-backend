import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  AccountId,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenMintTransaction,
  TokenNftInfoQuery,
  TransactionResponse,
  TransactionReceipt,
  Hbar,
  TransferTransaction,
  TokenAssociateTransaction,
  AccountBalanceQuery,
} from '@hashgraph/sdk';

@Injectable()
export class HederaService implements OnModuleInit {
  private readonly logger = new Logger(HederaService.name);
  private client: Client;
  private operatorId: AccountId;
  private operatorKey: PrivateKey;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeClient();
  }

  private async initializeClient() {
    try {
      const network = this.configService.get('hedera.network');
      const operatorIdString = this.configService.get('hedera.operatorId');
      const operatorKeyString = this.configService.get('hedera.operatorKey');

      if (!operatorIdString || !operatorKeyString) {
        throw new Error('Hedera operator ID and key must be provided');
      }

      this.operatorId = AccountId.fromString(operatorIdString);
      this.operatorKey = PrivateKey.fromString(operatorKeyString);

      // Initialize client based on network
      if (network === 'mainnet') {
        this.client = Client.forMainnet();
      } else {
        this.client = Client.forTestnet();
      }

      this.client.setOperator(this.operatorId, this.operatorKey);

      this.logger.log(`Hedera client initialized for ${network}`);
      this.logger.log(`Operator ID: ${this.operatorId}`);
    } catch (error) {
      this.logger.error('Failed to initialize Hedera client', error);
      throw error;
    }
  }

  async createNFTCollection(
    name: string,
    symbol: string,
    memo?: string,
  ): Promise<{ tokenId: string; transactionId: string }> {
    try {
      const transaction = new TokenCreateTransaction()
        .setTokenName(name)
        .setTokenSymbol(symbol)
        .setTokenType(TokenType.NonFungibleUnique)
        .setSupplyType(TokenSupplyType.Finite)
        .setMaxSupply(10000) // Max supply for the collection
        .setTreasuryAccountId(this.operatorId)
        .setSupplyKey(this.operatorKey)
        .setAdminKey(this.operatorKey)
        .setFreezeDefault(false);

      if (memo) {
        transaction.setTokenMemo(memo);
      }

      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);
      const tokenId = receipt.tokenId;

      this.logger.log(`NFT Collection created: ${tokenId}`);

      return {
        tokenId: tokenId.toString(),
        transactionId: response.transactionId.toString(),
      };
    } catch (error) {
      this.logger.error('Failed to create NFT collection', error);
      throw error;
    }
  }

  async mintNFT(
    tokenId: string,
    metadata: Buffer[],
  ): Promise<{ serialNumbers: number[]; transactionId: string }> {
    try {
      const transaction = new TokenMintTransaction()
        .setTokenId(tokenId)
        .setMetadata(metadata);

      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);
      const serialNumbers = receipt.serials.map((serial) => serial.toNumber());

      this.logger.log(`NFT minted with serial numbers: ${serialNumbers}`);

      return {
        serialNumbers,
        transactionId: response.transactionId.toString(),
      };
    } catch (error) {
      this.logger.error('Failed to mint NFT', error);
      throw error;
    }
  }

  async getNFTInfo(tokenId: string, serialNumber: number) {
    try {
      const query = new TokenNftInfoQuery()
        .setTokenId(tokenId)
        .setNftId(serialNumber);

      const nftInfo = await query.execute(this.client);

      return {
        tokenId: nftInfo.nftId.tokenId.toString(),
        serialNumber: nftInfo.nftId.serial.toNumber(),
        accountId: nftInfo.accountId?.toString(),
        creationTime: nftInfo.creationTime.toDate(),
        metadata: nftInfo.metadata,
        spenderAccountId: nftInfo.spenderAccountId?.toString(),
      };
    } catch (error) {
      this.logger.error('Failed to get NFT info', error);
      throw error;
    }
  }

  async transferNFT(
    tokenId: string,
    serialNumber: number,
    fromAccountId: string,
    toAccountId: string,
    fromPrivateKey?: string,
  ): Promise<{ transactionId: string }> {
    try {
      const transaction = new TransferTransaction()
        .addNftTransfer(tokenId, serialNumber, fromAccountId, toAccountId);

      // If a different private key is provided, use it to sign
      if (fromPrivateKey) {
        const privateKey = PrivateKey.fromString(fromPrivateKey);
        transaction.sign(privateKey);
      }

      const response = await transaction.execute(this.client);
      await response.getReceipt(this.client);

      this.logger.log(`NFT transferred: ${tokenId}/${serialNumber}`);

      return {
        transactionId: response.transactionId.toString(),
      };
    } catch (error) {
      this.logger.error('Failed to transfer NFT', error);
      throw error;
    }
  }

  async associateToken(
    accountId: string,
    tokenId: string,
    privateKey: string,
  ): Promise<{ transactionId: string }> {
    try {
      const transaction = new TokenAssociateTransaction()
        .setAccountId(accountId)
        .setTokenIds([tokenId]);

      const accountPrivateKey = PrivateKey.fromString(privateKey);
      transaction.sign(accountPrivateKey);

      const response = await transaction.execute(this.client);
      await response.getReceipt(this.client);

      this.logger.log(`Token associated: ${tokenId} to ${accountId}`);

      return {
        transactionId: response.transactionId.toString(),
      };
    } catch (error) {
      this.logger.error('Failed to associate token', error);
      throw error;
    }
  }

  async getAccountBalance(accountId: string) {
    try {
      const query = new AccountBalanceQuery().setAccountId(accountId);
      const balance = await query.execute(this.client);

      return {
        hbars: balance.hbars.toString(),
        tokens: Object.fromEntries(
          balance.tokens.entries().map(([tokenId, amount]) => [
            tokenId.toString(),
            amount.toString(),
          ]),
        ),
      };
    } catch (error) {
      this.logger.error('Failed to get account balance', error);
      throw error;
    }
  }

  getClient(): Client {
    return this.client;
  }

  getOperatorId(): AccountId {
    return this.operatorId;
  }

  getOperatorKey(): PrivateKey {
    return this.operatorKey;
  }
}
