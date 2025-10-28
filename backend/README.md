# IP-NFT Platform Backend

A comprehensive NestJS backend for the IP-NFT platform that integrates with Hedera Hashgraph smart contracts and Supabase for data logging and analytics.

## 🚀 Features

### Core Functionality
- **Hedera Integration**: Direct integration with Hedera Token Service (HTS) and smart contracts
- **Smart Contract Support**: Full support for IP-NFT, Marketplace, and Escrow contracts
- **Supabase Integration**: Complete data logging and analytics with PostgreSQL
- **Real-time Analytics**: Track mints, transactions, and platform metrics
- **RESTful API**: Comprehensive API endpoints with Swagger documentation

### Smart Contract Integration
- **IP-NFT Contract**: Mint, transfer, and manage intellectual property NFTs
- **Marketplace Contract**: List items, create auctions, handle sales
- **Escrow Contract**: Secure transactions with verification requirements

### Data Logging & Analytics
- **Transaction Tracking**: Log every marketplace and escrow transaction
- **IP-NFT Registry**: Complete database of all minted IP-NFTs
- **Analytics Dashboard**: Real-time metrics and historical data
- **Performance Monitoring**: Track gas usage, transaction success rates

## 🏗️ Architecture

```
backend/
├── src/
│   ├── modules/
│   │   ├── hedera/           # Hedera SDK integration
│   │   ├── supabase/         # Database operations
│   │   ├── ipnft/           # IP-NFT management
│   │   ├── marketplace/      # Marketplace operations
│   │   ├── escrow/          # Escrow management
│   │   └── analytics/       # Analytics & metrics
│   ├── config/              # Configuration management
│   ├── app.module.ts        # Main application module
│   └── main.ts             # Application entry point
├── database/
│   └── supabase-schema.sql  # Database schema
└── package.json            # Dependencies
```

## 📋 Prerequisites

- Node.js 18+ and npm/yarn
- Hedera Testnet/Mainnet account with HBAR
- Supabase project setup
- Deployed smart contracts (IP-NFT, Marketplace, Escrow)

## 🛠️ Installation

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Environment Configuration
```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Hedera Configuration
HEDERA_NETWORK=testnet
HEDERA_OPERATOR_ID=0.0.123456
HEDERA_OPERATOR_KEY=302e020100300506032b657004220420...

# Smart Contract Addresses
IPNFT_CONTRACT_ADDRESS=0x...
MARKETPLACE_CONTRACT_ADDRESS=0x...
ESCROW_CONTRACT_ADDRESS=0x...

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

### 3. Database Setup
1. Create a new Supabase project
2. Run the SQL schema in your Supabase SQL editor:
```bash
# Copy the contents of backend/database/supabase-schema.sql
# and execute in Supabase SQL editor
```

### 4. Start the Application
```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`

## 📚 API Documentation

Visit `http://localhost:3000/api` for interactive Swagger documentation.

### Key Endpoints

#### IP-NFT Management
- `POST /api/v1/ipnft/mint` - Mint new IP-NFT
- `GET /api/v1/ipnft/:tokenId` - Get IP-NFT details
- `GET /api/v1/ipnft/creator/:address` - Get IP-NFTs by creator
- `GET /api/v1/ipnft/owner/:address` - Get IP-NFTs by owner

#### Marketplace Operations
- `POST /api/v1/marketplace/list` - List NFT for sale
- `POST /api/v1/marketplace/auction` - Create auction
- `POST /api/v1/marketplace/buy/:listingId` - Buy NFT
- `GET /api/v1/marketplace/transactions` - Get marketplace transactions

#### Escrow Management
- `POST /api/v1/escrow/create` - Create escrow agreement
- `POST /api/v1/escrow/:escrowId/verify` - Submit verification
- `POST /api/v1/escrow/:escrowId/complete` - Complete escrow

#### Analytics
- `GET /api/v1/analytics/overview` - Overall platform analytics
- `GET /api/v1/analytics/ipnfts` - IP-NFT specific metrics
- `GET /api/v1/analytics/marketplace` - Marketplace analytics
- `GET /api/v1/analytics/escrow` - Escrow analytics

## 🔧 Configuration

### Hedera Setup
1. Create account on [Hedera Portal](https://portal.hedera.com/)
2. Fund account with HBAR for operations
3. Export account ID and private key

### Smart Contract Deployment
Ensure your smart contracts are deployed and addresses are configured:
- IP-NFT Contract: Handles minting and metadata
- Marketplace Contract: Manages listings and auctions
- Escrow Contract: Handles secure transactions

### Supabase Configuration
1. Create new Supabase project
2. Run the provided schema
3. Configure Row Level Security policies
4. Get project URL and API keys

## 🔐 Security Features

- **Input Validation**: Class-validator for all DTOs
- **Rate Limiting**: Protection against API abuse
- **CORS Configuration**: Secure cross-origin requests
- **Environment Variables**: Sensitive data protection
- **Database Security**: Row Level Security with Supabase

## 📊 Data Models

### IP-NFT Record
```typescript
interface IPNFTRecord {
  token_id: string;
  title: string;
  description: string;
  ip_type: string;
  creator_address: string;
  owner_address: string;
  content_hash: string;
  metadata_bytes: string;
  // ... additional fields
}
```

### Marketplace Transaction
```typescript
interface MarketplaceTransaction {
  transaction_type: 'listing' | 'sale' | 'auction_created' | 'bid_placed' | 'auction_ended';
  token_id: string;
  seller_address: string;
  buyer_address?: string;
  price: string;
  transaction_hash: string;
  // ... additional fields
}
```

### Escrow Transaction
```typescript
interface EscrowTransaction {
  escrow_id: string;
  transaction_type: 'created' | 'verification_submitted' | 'completed' | 'disputed';
  token_id: string;
  seller_address: string;
  buyer_address: string;
  price: string;
  // ... additional fields
}
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📈 Analytics Features

The platform tracks comprehensive metrics:

- **IP-NFT Metrics**: Total mints, by type, by creator
- **Marketplace Activity**: Sales volume, conversion rates, active listings
- **Escrow Performance**: Completion rates, dispute resolution
- **User Analytics**: Active users, transaction patterns
- **Historical Data**: Daily snapshots for trend analysis

## 🚀 Deployment

### Production Build
```bash
npm run build
npm run start:prod
```

### Environment Variables for Production
Ensure all production environment variables are set:
- Hedera mainnet configuration
- Production Supabase instance
- Deployed smart contract addresses
- Security configurations

## 🤝 API Usage Examples

### Mint an IP-NFT
```bash
curl -X POST http://localhost:3000/api/v1/ipnft/mint \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Revolutionary AI Algorithm",
    "description": "Breakthrough ML algorithm",
    "ipType": "Patent",
    "tags": ["AI", "ML"],
    "contentHash": "bafkreicrhuxfzrydht6tmd4kyy6pkbhspqthswg6xbiqlaztmf774ojxhq",
    "metadataBytes": "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
    "toAddress": "0x742d35Cc6634C0532925a3b8D6Ac6E1e9F1F1234"
  }'
```

### List NFT for Sale
```bash
curl -X POST http://localhost:3000/api/v1/marketplace/list \
  -H "Content-Type: application/json" \
  -d '{
    "tokenAddress": "0x...",
    "tokenId": "1",
    "price": "1.5",
    "sellerAddress": "0x742d35Cc6634C0532925a3b8D6Ac6E1e9F1F1234"
  }'
```

## 🔮 Future Enhancements

- **Event Listeners**: Real-time blockchain event monitoring
- **Caching Layer**: Redis integration for performance
- **Batch Operations**: Bulk minting and transaction processing
- **Advanced Analytics**: Machine learning insights
- **Mobile SDK**: React Native integration

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the API documentation at `/api` endpoint
- Review the database schema in `database/supabase-schema.sql`
- Examine the smart contract integration in `src/modules/hedera/`

## 🏷️ Tags

`hedera` `hashgraph` `nestjs` `supabase` `ipnft` `blockchain` `smart-contracts` `analytics`
