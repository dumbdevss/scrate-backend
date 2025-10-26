export interface HederaConfig {
  operatorId: string;
  operatorKey: string;
  network: 'testnet' | 'mainnet' | 'previewnet';
}

export interface CollectionInfo {
  tokenId: string;
  tokenAddress: string;
  name: string;
  symbol: string;
  totalSupply: number;
  maxSupply?: number;
  treasuryAccountId: string;
}

export interface NftInfo {
  tokenId: string;
  serialNumber: number;
  accountId: string;
  metadata: any;
  createdTimestamp: string;
}

export interface MintResult {
  tokenId: string;
  serialNumbers: number[];
  transactionId: string;
  nftInfo: NftInfo[];
}

export interface IpnftMetadata {
  name: string;
  description?: string;
  image?: string;
  ipfsHash: string;
  attributes?: Record<string, any>;
}
