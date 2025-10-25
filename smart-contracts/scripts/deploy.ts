import { network } from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { ethers } = await network.connect({ network: "testnet" });

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // 1) Deploy IPNFTMarketplace
  console.log("\n1. Deploying IPNFTMarketplace...");
  const IPNFTMarketplace = await ethers.getContractFactory("IPNFTMarketplace");
  const marketplace = await IPNFTMarketplace.deploy();
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("IPNFTMarketplace deployed to:", marketplaceAddress);

  // 2) Deploy IPNFTEscrow with dispute resolver
  console.log("\n2. Deploying IPNFTEscrow...");
  const IPNFTEscrow = await ethers.getContractFactory("IPNFTEscrow");
  const escrow = await IPNFTEscrow.deploy(deployer.address); // Using deployer as initial dispute resolver
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("IPNFTEscrow deployed to:", escrowAddress);

  // 3) Verify initial configuration
  console.log("\n3. Verifying initial configuration...");
  const marketplaceFee = await marketplace.platformFee();
  const escrowFeeRate = await escrow.escrowFeeRate();
  const disputeResolver = await escrow.disputeResolver();

  console.log("Marketplace platform fee:", marketplaceFee.toString(), "basis points");
  console.log("Escrow fee rate:", escrowFeeRate.toString(), "basis points");
  console.log("Dispute resolver:", disputeResolver);

  // 4) Save deployment info
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    deployer: deployer.address,
    contracts: {
      IPNFTMarketplace: {
        address: marketplaceAddress,
        transactionHash: marketplace.deploymentTransaction()?.hash,
        platformFee: marketplaceFee.toString(),
      },
      IPNFTEscrow: {
        address: escrowAddress,
        transactionHash: escrow.deploymentTransaction()?.hash,
        escrowFeeRate: escrowFeeRate.toString(),
        disputeResolver,
      },
    },
    deployedAt: new Date().toISOString(),
  };

  // Create a deployment folder (if it doesn't exist)
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Write JSON file
  const filePath = path.join(deploymentsDir, `${deploymentInfo.network}-deployment.json`);
  fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n✅ Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n📦 Saved deployment info to: ${filePath}`);
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
