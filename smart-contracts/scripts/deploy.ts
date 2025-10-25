import { network } from "hardhat";

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
  console.log("Marketplace platform fee:", marketplaceFee.toString(), "basis points");
  
  const escrowFeeRate = await escrow.escrowFeeRate();
  console.log("Escrow fee rate:", escrowFeeRate.toString(), "basis points");
  
  const disputeResolver = await escrow.disputeResolver();
  console.log("Dispute resolver:", disputeResolver);

  // 4) Save deployment info
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    deployer: deployer.address,
    contracts: {
      IPNFTMarketplace: {
        address: marketplaceAddress,
        transactionHash: marketplace.deploymentTransaction()?.hash,
      },
      IPNFTEscrow: {
        address: escrowAddress,
        transactionHash: escrow.deploymentTransaction()?.hash,
      },
    },
    deployedAt: new Date().toISOString(),
  };

  console.log("\n4. Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
