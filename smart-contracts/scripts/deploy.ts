import { network } from "hardhat";

const { ethers } = await network.connect({ network: "testnet" });

async function main() {
  console.log("Deploying IP-NFT Platform Smart Contracts...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy IPNFTMarketplace
  console.log("\n1. Deploying IPNFTMarketplace...");
  const IPNFTMarketplace = await ethers.getContractFactory("IPNFTMarketplace");
  const marketplace = await IPNFTMarketplace.deploy();
  await marketplace.deployed();
  console.log("IPNFTMarketplace deployed to:", marketplace.address);

  // Deploy IPNFTEscrow with dispute resolver (using deployer as initial resolver)
  console.log("\n2. Deploying IPNFTEscrow...");
  const IPNFTEscrow = await ethers.getContractFactory("IPNFTEscrow");
  const escrow = await IPNFTEscrow.deploy(deployer.address);
  await escrow.deployed();
  console.log("IPNFTEscrow deployed to:", escrow.address);

  // Verify initial configuration
  console.log("\n3. Verifying initial configuration...");
  
  const marketplaceFee = await marketplace.platformFee();
  console.log("Marketplace platform fee:", marketplaceFee.toString(), "basis points");
  
  const escrowFeeRate = await escrow.escrowFeeRate();
  console.log("Escrow fee rate:", escrowFeeRate.toString(), "basis points");
  
  const disputeResolver = await escrow.disputeResolver();
  console.log("Dispute resolver:", disputeResolver);

  // Save deployment addresses
  const deploymentInfo = {
    network: await ethers.provider.getNetwork(),
    deployer: deployer.address,
    contracts: {
      IPNFTMarketplace: {
        address: marketplace.address,
        transactionHash: marketplace.deployTransaction.hash,
      },
      IPNFTEscrow: {
        address: escrow.address,
        transactionHash: escrow.deployTransaction.hash,
      },
    },
    deployedAt: new Date().toISOString(),
  };

  console.log("\n4. Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Save to file
  const fs = require('fs');
  const path = require('path');
  
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  const networkName = deploymentInfo.network.name;
  const deploymentFile = path.join(deploymentsDir, `${networkName}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  
  console.log(`\nDeployment info saved to: ${deploymentFile}`);
  
  console.log("\n✅ Deployment completed successfully!");
  console.log("\nNext steps:");
  console.log("1. Update your .env file with the contract addresses");
  console.log("2. Verify contracts on block explorer if needed");
  console.log("3. Configure marketplace and escrow settings as needed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
