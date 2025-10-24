# Hedera IPNFT Service

A NestJS-based service for creating and managing IP-based NFTs (IPNFTs) on the Hedera network using the Hedera Token Service (HTS).

## Features

- **Create NFT Collections**: Create new NFT collections on Hedera with customizable properties
- **Mint IPNFTs**: Mint NFTs with IPFS metadata and custom attributes
- **Token Information**: Retrieve detailed information about collections and individual NFTs
- **Hedera Integration**: Full integration with Hedera Token Service using the official SDK
- **API Documentation**: Swagger/OpenAPI documentation for all endpoints

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Hedera testnet/mainnet account with HBAR balance
- IPFS node or service for storing NFT metadata (optional)

## Installation

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Copy the environment configuration:
```bash
cp .env.example .env
```

3. Configure your Hedera credentials in `.env`:
```env
HEDERA_OPERATOR_ID=0.0.YOUR_ACCOUNT_ID
HEDERA_OPERATOR_KEY=YOUR_PRIVATE_KEY_HERE
HEDERA_NETWORK=testnet
PORT=3000
```

## Getting Started

### Setting up Hedera Account

1. Create a Hedera account on [Hedera Portal](https://portal.hedera.com/)
2. For testnet: Get free HBAR from the [Hedera faucet](https://portal.hedera.com/faucet)
3. Note your Account ID and Private Key for configuration

### Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The service will be available at:
- API: `http://localhost:3000`
- Documentation: `http://localhost:3000/api`

## API Endpoints

### Create Collection
```http
POST /hedera/collections
Content-Type: application/json

{
  "name": "My IPNFT Collection",
  "symbol": "IPNFT",
  "description": "A collection of IP-based NFTs",
  "maxSupply": 1000
}
```

### Mint IPNFT
```http
POST /hedera/nfts/mint
Content-Type: application/json

{
  "tokenId": "0.0.123456",
  "ipfsHash": "QmYourIPFSHashHere",
  "name": "My First IPNFT",
  "description": "An innovative IP-based NFT",
  "imageUrl": "https://ipfs.io/ipfs/QmImageHash",
  "attributes": {
    "trait_type": "Rarity",
    "value": "Rare"
  }
}
```

### Get Collection Info
```http
GET /hedera/collections/{tokenId}
```

### Get NFT Info
```http
GET /hedera/nfts/{tokenId}/{serialNumber}
```

## Response Examples

### Collection Creation Response
```json
{
  "tokenId": "0.0.123456",
  "tokenAddress": "0.0.123456",
  "name": "My IPNFT Collection",
  "symbol": "IPNFT",
  "totalSupply": 0,
  "maxSupply": 1000,
  "treasuryAccountId": "0.0.12345"
}
```

### NFT Minting Response
```json
{
  "tokenId": "0.0.123456",
  "serialNumbers": [1],
  "transactionId": "0.0.12345@1234567890.123456789",
  "nftInfo": [
    {
      "tokenId": "0.0.123456",
      "serialNumber": 1,
      "accountId": "0.0.12345",
      "metadata": "{\"name\":\"My First IPNFT\",\"ipfsHash\":\"QmYourIPFSHashHere\"}",
      "createdTimestamp": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

## IPNFT Metadata Structure

The service stores NFT metadata in the following format:

```json
{
  "name": "NFT Name",
  "description": "NFT Description",
  "image": "https://ipfs.io/ipfs/QmImageHash",
  "ipfsHash": "QmMetadataHash",
  "attributes": {
    "trait_type": "value",
    "another_trait": "another_value"
  }
}
```

## Development

### Project Structure
```
src/
├── hedera/
│   ├── controllers/     # API controllers
│   ├── services/        # Business logic
│   ├── dto/            # Data transfer objects
│   ├── interfaces/     # TypeScript interfaces
│   └── hedera.module.ts
├── app.module.ts
└── main.ts
```

### Running Tests
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

### Code Quality
```bash
# Linting
npm run lint

# Formatting
npm run format
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HEDERA_OPERATOR_ID` | Your Hedera account ID | Required |
| `HEDERA_OPERATOR_KEY` | Your Hedera private key | Required |
| `HEDERA_NETWORK` | Hedera network (testnet/mainnet/previewnet) | testnet |
| `PORT` | Application port | 3000 |

### Network Configuration

- **Testnet**: Free for development and testing
- **Previewnet**: Preview of upcoming features
- **Mainnet**: Production network (requires real HBAR)

## Error Handling

The service includes comprehensive error handling:

- **Validation Errors**: Invalid input parameters
- **Hedera Errors**: Network or transaction failures
- **Authentication Errors**: Invalid credentials
- **Rate Limiting**: Hedera network rate limits

## Security Considerations

- Store private keys securely (use environment variables)
- Never commit private keys to version control
- Use testnet for development and testing
- Implement proper access controls for production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Check the [Hedera documentation](https://docs.hedera.com/)
- Review the [Hedera SDK documentation](https://github.com/hashgraph/hedera-sdk-js)
- Open an issue in this repository
