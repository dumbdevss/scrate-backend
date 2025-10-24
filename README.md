# IP-NFT Platform on Hedera Hashgraph

A comprehensive platform for minting, trading, and managing Intellectual Property Non-Fungible Tokens (IP-NFTs) using Hedera Token Service (HTS), with marketplace and escrow functionality for Real World Assets (RWA).

## 🚀 Features

### Core Functionality
- **IP-NFT Minting**: Single-function minting with comprehensive metadata using Hedera Token Service
- **Metadata Validation**: JSON schema validation for IP-NFT metadata
- **Analytics Dashboard**: Real-time tracking of mints, transactions, and platform metrics
- **Supabase Integration**: Database tracking for all platform activities

### Marketplace
- **Direct Sales**: List IP-NFTs for immediate purchase
- **Auction System**: Time-based auctions with automatic bid extensions
- **Platform Fees**: Configurable fee structure for transactions

### Escrow System
- **RWA Verification**: Multi-step verification process for Real World Assets
- **Document Verification**: Hash-based document integrity checks
- **Dispute Resolution**: Built-in dispute resolution mechanism
- **Flexible Requirements**: Customizable verification requirements per transaction

## 🏗️ Architecture

### Backend (NestJS)
- **Hedera Service**: Core integration with Hedera Token Service
- **IP-NFT Controller**: RESTful API endpoints
- **Supabase Integration**: Database operations and analytics
- **Metadata Validation**: Schema-based validation system

### Smart Contracts (Solidity)
- **IPNFTMarketplace.sol**: Marketplace functionality with auctions
- **IPNFTEscrow.sol**: Escrow system with verification requirements

### Database (Supabase)
- **IP-NFT Tracking**: Comprehensive NFT metadata and ownership
- **Transaction History**: All platform transactions
- **Analytics**: Daily metrics and platform statistics
- **User Management**: Account verification and activity tracking

## 📋 Prerequisites

- Node.js 18+ and npm/yarn
- Hedera Testnet/Mainnet account with HBAR
- Supabase project setup
- Hardhat for smart contract deployment

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd scrate-backend
```

### 2. Backend Setup
```bash
cd backend
npm install

# Copy environment configuration
cp .env.example .env

# Configure your environment variables
# Edit .env with your Hedera and Supabase credentials
```

### 3. Smart Contracts Setup
```bash
cd smart-contracts
npm install

# Configure Hardhat network settings
# Edit hardhat.config.ts with your network preferences
```

### 4. Database Setup
```bash
# Run the Supabase schema in your Supabase project
# Execute the SQL in backend/database/supabase-schema.sql
```

## ⚙️ Configuration

### Environment Variables

```env
# Hedera Configuration
HEDERA_OPERATOR_ID=0.0.123456
HEDERA_OPERATOR_KEY=302e020100300506032b657004220420...
HEDERA_NETWORK=testnet
IPNFT_COLLECTION_ID=

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# API Configuration
PORT=3000
NODE_ENV=development

# Smart Contract Addresses
MARKETPLACE_CONTRACT_ADDRESS=
ESCROW_CONTRACT_ADDRESS=
```

### Hedera Account Setup
1. Create a Hedera account on [Hedera Portal](https://portal.hedera.com/)
2. Fund your account with HBAR for testnet/mainnet operations
3. Export your account ID and private key to environment variables

### Supabase Setup
1. Create a new project on [Supabase](https://supabase.com/)
2. Run the provided SQL schema in the SQL editor
3. Configure Row Level Security policies as needed
4. Get your project URL and API keys

## 🚀 Usage

### Start the Backend Server
```bash
cd backend
npm run start:dev
```

The API will be available at `http://localhost:3000`

### API Documentation
Visit `http://localhost:3000/api` for Swagger documentation

### Deploy Smart Contracts
```bash
cd smart-contracts
npx hardhat compile
npx hardhat deploy --network testnet
```

## 📚 API Endpoints

### IP-NFT Management
- `POST /ipnft/collection/create` - Create IP-NFT collection
- `POST /ipnft/mint` - Mint new IP-NFT
- `GET /ipnft/nft/:serialNumber` - Get IP-NFT details
- `GET /ipnft/collection/info` - Get collection information
- `POST /ipnft/validate-metadata` - Validate metadata schema

### Analytics
- `GET /ipnft/analytics` - Get platform analytics

### Marketplace (Smart Contract Integration)
- `POST /ipnft/marketplace/list` - List IP-NFT for sale
- `POST /ipnft/marketplace/auction` - Create auction

### Escrow (Smart Contract Integration)
- `POST /ipnft/escrow/create` - Create escrow agreement

## 📊 IP-NFT Metadata Schema

```json
{
  "schema_version": "1.0.0",
  "name": "Research Project IP-NFT",
  "description": "Intellectual property for breakthrough research",
  "image": "https://example.com/image.png",
  "external_url": "https://example.com/details",
  "properties": {
    "type": "IP-NFT",
    "agreements": [
      {
        "type": "License Agreement",
        "url": "https://storage.com/agreement.pdf",
        "mime_type": "application/pdf",
        "content_hash": "bafkreicrhuxfzrydht6tmd4kyy6pkbhspqthswg6xbiqlaztmf774ojxhq"
      }
    ],
    "project_details": {
      "industry": "Pharmaceutical R&D",
      "organization": "University Research Lab",
      "topic": "Novel Drug Discovery",
      "research_lead": {
        "name": "Dr. Jane Smith",
        "email": "jane.smith@university.edu",
        "orcid": "0000-0000-0000-0000"
      }
    }
  }
}
```

## 🔐 Security Features

### Smart Contract Security
- **ReentrancyGuard**: Protection against reentrancy attacks
- **Access Control**: Owner-only functions for critical operations
- **Input Validation**: Comprehensive parameter validation
- **Emergency Stops**: Pausable functionality for emergency situations

### API Security
- **Input Validation**: Class-validator for all DTOs
- **Rate Limiting**: Protection against abuse
- **CORS Configuration**: Secure cross-origin requests
- **Environment Variables**: Sensitive data protection

### Database Security
- **Row Level Security**: User-specific data access
- **Encrypted Storage**: Sensitive data encryption
- **Audit Logging**: Complete transaction history
- **Backup Strategy**: Regular automated backups

## 🧪 Testing

### Run Backend Tests
```bash
cd backend
npm run test
npm run test:e2e
```

### Run Smart Contract Tests
```bash
cd smart-contracts
npx hardhat test
```

## 📈 Analytics and Monitoring

The platform tracks:
- **Minting Activity**: Total IP-NFTs minted, daily mints
- **Trading Volume**: Marketplace sales, auction activity
- **User Engagement**: Active users, transaction frequency
- **Escrow Activity**: Active escrows, completion rates
- **Revenue Metrics**: Platform fees collected

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in the `/docs` folder
- Review the API documentation at `/api` endpoint

## 🔮 Roadmap

### Phase 1 (Current)
- ✅ Basic IP-NFT minting with HTS
- ✅ Metadata validation system
- ✅ Supabase integration
- ✅ Analytics dashboard

### Phase 2 (Next)
- 🔄 Smart contract marketplace integration
- 🔄 Escrow system implementation
- 🔄 Frontend application
- 🔄 Advanced search and filtering

### Phase 3 (Future)
- 📋 Decentralized storage integration (IPFS/Arweave)
- 📋 Token-gated access control
- 📋 Fractional ownership
- 📋 Cross-chain compatibility

## 🏷️ Tags

`hedera` `hashgraph` `nft` `intellectual-property` `blockchain` `nestjs` `supabase` `marketplace` `escrow` `defi`
