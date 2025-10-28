#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up IP-NFT Platform Backend...\n');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ Created .env file from .env.example');
  } else {
    console.log('❌ .env.example file not found');
  }
} else {
  console.log('✅ .env file already exists');
}

// Check required environment variables
console.log('\n📋 Environment Configuration Checklist:');

const requiredEnvVars = [
  'HEDERA_OPERATOR_ID',
  'HEDERA_OPERATOR_KEY',
  'IPNFT_CONTRACT_ADDRESS',
  'MARKETPLACE_CONTRACT_ADDRESS',
  'ESCROW_CONTRACT_ADDRESS',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY'
];

let missingVars = [];

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  requiredEnvVars.forEach(varName => {
    const hasVar = envContent.includes(`${varName}=`) && 
                   !envContent.includes(`${varName}=your-`) && 
                   !envContent.includes(`${varName}=0x...`);
    
    if (hasVar) {
      console.log(`✅ ${varName}`);
    } else {
      console.log(`❌ ${varName} - needs configuration`);
      missingVars.push(varName);
    }
  });
}

if (missingVars.length > 0) {
  console.log(`\n⚠️  Please configure the following environment variables in .env:`);
  missingVars.forEach(varName => {
    console.log(`   - ${varName}`);
  });
}

console.log('\n📚 Next Steps:');
console.log('1. Configure your .env file with proper values');
console.log('2. Set up your Supabase database with the provided schema');
console.log('3. Deploy your smart contracts and update contract addresses');
console.log('4. Run: npm run start:dev');
console.log('5. Visit: http://localhost:3000/api for API documentation');

console.log('\n🔗 Useful Links:');
console.log('- Hedera Portal: https://portal.hedera.com/');
console.log('- Supabase Dashboard: https://supabase.com/dashboard');
console.log('- API Documentation: http://localhost:3000/api (after starting)');

console.log('\n✨ Setup complete! Happy coding! 🎉');
