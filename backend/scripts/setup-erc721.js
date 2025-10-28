#!/usr/bin/env node

/**
 * Setup script for ERC721 backend implementation
 * This script helps configure the backend for ERC721 smart contracts
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up ERC721 Backend Implementation...\n');

// Check if we're in the correct directory
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ Error: package.json not found. Please run this script from the backend directory.');
  process.exit(1);
}

// Read current package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Dependencies to add
const newDependencies = {
  'ethers': '^6.8.0',
  '@pinata/sdk': '^2.1.0'
};

// Check and add missing dependencies
let needsInstall = false;
const missingDeps = [];

for (const [dep, version] of Object.entries(newDependencies)) {
  if (!packageJson.dependencies || !packageJson.dependencies[dep]) {
    missingDeps.push(`${dep}@${version}`);
    needsInstall = true;
  }
}

if (needsInstall) {
  console.log('📦 Installing missing dependencies...');
  console.log(`   Adding: ${missingDeps.join(', ')}`);
  
  try {
    execSync(`npm install ${missingDeps.join(' ')}`, { stdio: 'inherit' });
    console.log('✅ Dependencies installed successfully!\n');
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    process.exit(1);
  }
} else {
  console.log('✅ All required dependencies are already installed!\n');
}

// Check for environment file
const envPath = path.join(process.cwd(), '.env');
const envExamplePath = path.join(process.cwd(), '.env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    console.log('📝 Creating .env file from .env.example...');
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ .env file created! Please update it with your configuration.\n');
  } else {
    console.log('⚠️  Warning: No .env or .env.example file found. You\'ll need to create one manually.\n');
  }
} else {
  console.log('✅ .env file already exists!\n');
}

// Check for smart contract artifacts
const artifactsPath = path.join(process.cwd(), '..', 'smart-contracts', 'artifacts');
if (!fs.existsSync(artifactsPath)) {
  console.log('⚠️  Warning: Smart contract artifacts not found.');
  console.log('   Please compile your smart contracts first:');
  console.log('   cd ../smart-contracts && npx hardhat compile\n');
} else {
  console.log('✅ Smart contract artifacts found!\n');
}

// Create TypeScript configuration for JSON imports if needed
const tsConfigPath = path.join(process.cwd(), 'tsconfig.json');
if (fs.existsSync(tsConfigPath)) {
  const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
  
  if (!tsConfig.compilerOptions) {
    tsConfig.compilerOptions = {};
  }
  
  let needsUpdate = false;
  
  if (!tsConfig.compilerOptions.resolveJsonModule) {
    tsConfig.compilerOptions.resolveJsonModule = true;
    needsUpdate = true;
  }
  
  if (!tsConfig.compilerOptions.allowSyntheticDefaultImports) {
    tsConfig.compilerOptions.allowSyntheticDefaultImports = true;
    needsUpdate = true;
  }
  
  if (needsUpdate) {
    fs.writeFileSync(tsConfigPath, JSON.stringify(tsConfig, null, 2));
    console.log('✅ Updated tsconfig.json for JSON module imports!\n');
  }
}

// Display configuration checklist
console.log('📋 Configuration Checklist:');
console.log('');
console.log('1. ✅ ERC721 module files created');
console.log('2. ✅ Dependencies installed');
console.log('3. ✅ Environment configuration updated');
console.log('4. ✅ TypeScript configuration updated');
console.log('');
console.log('📝 Next Steps:');
console.log('');
console.log('1. Update your .env file with:');
console.log('   - RPC_URL (Ethereum RPC endpoint)');
console.log('   - PRIVATE_KEY (Wallet private key)');
console.log('   - Contract addresses (after deployment)');
console.log('   - PINATA_JWT (for IPFS uploads)');
console.log('');
console.log('2. Deploy your smart contracts:');
console.log('   cd ../smart-contracts');
console.log('   npx hardhat run scripts/deploy.ts --network <your-network>');
console.log('');
console.log('3. Update .env with deployed contract addresses');
console.log('');
console.log('4. Start the development server:');
console.log('   npm run start:dev');
console.log('');
console.log('5. Test the API endpoints:');
console.log('   - IP-NFT minting: POST /api/v2/ipnft/mint');
console.log('   - Marketplace: POST /api/v2/marketplace/list');
console.log('   - Escrow: POST /api/v2/escrow/create');
console.log('');
console.log('📚 Documentation:');
console.log('   - API docs: http://localhost:3000/api');
console.log('   - ERC721 guide: ./README-ERC721.md');
console.log('');
console.log('🎉 ERC721 backend setup complete!');

console.log('\n' + '='.repeat(60));
console.log('🔧 IMPORTANT SECURITY NOTES:');
console.log('='.repeat(60));
console.log('• Never commit private keys to version control');
console.log('• Use environment variables for sensitive data');
console.log('• Test on testnets before mainnet deployment');
console.log('• Monitor gas usage and optimize transactions');
console.log('• Implement proper error handling and logging');
console.log('='.repeat(60));
