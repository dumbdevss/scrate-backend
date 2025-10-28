export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  
  hedera: {
    network: process.env.HEDERA_NETWORK || 'testnet',
    operatorId: process.env.HEDERA_OPERATOR_ID,
    operatorKey: process.env.HEDERA_OPERATOR_KEY,
    mirrorNodeUrl: process.env.HEDERA_MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com',
  },
  
  contracts: {
    ipnft: process.env.IPNFT_CONTRACT_ADDRESS,
    marketplace: process.env.MARKETPLACE_CONTRACT_ADDRESS,
    escrow: process.env.ESCROW_CONTRACT_ADDRESS,
  },
  
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  },
  
  security: {
    jwtSecret: process.env.JWT_SECRET,
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  },
  
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL, 10) || 60,
    limit: parseInt(process.env.THROTTLE_LIMIT, 10) || 100,
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
});
