import { network } from "hardhat";

const { ethers } = await network.connect({ network: "testnet" });

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contract with the account:", deployer.address);

  // 1) Deploy the HederaIpNft contract
  const HederaIpNft = await ethers.getContractFactory("HederaIpNft", deployer);
  const contract = await HederaIpNft.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("HederaIpNft contract deployed at:", contractAddress);

  // 2) Create the HTS NFT collection by calling createIpNftCollection()
  const NAME = "Hedera IP NFT Collection";
  const SYMBOL = "HIPNFT";
  const ROYALTY_BASIS_POINTS = 1000; // 10% royalty (1000 / 10000)
  const ROYALTY_COLLECTOR = deployer.address; // Deployer receives royalties
  const HBAR_TO_SEND = "15"; // HBAR to send with createIpNftCollection()

  console.log(
    `Calling createIpNftCollection() with ${HBAR_TO_SEND} HBAR to create the HTS collection...`
  );
  console.log(`  Name: ${NAME}`);
  console.log(`  Symbol: ${SYMBOL}`);
  console.log(`  Royalty: ${ROYALTY_BASIS_POINTS / 100}%`);
  console.log(`  Royalty Collector: ${ROYALTY_COLLECTOR}`);

  const tx = await contract.createIpNftCollection(
    NAME,
    SYMBOL,
    ROYALTY_BASIS_POINTS,
    ROYALTY_COLLECTOR,
    {
      gasLimit: 300_000,
      value: ethers.parseEther(HBAR_TO_SEND)
    }
  );
  await tx.wait();
  console.log("createIpNftCollection() tx hash:", tx.hash);

  // 3) Read the created HTS token address
  const tokenAddress = await contract.tokenAddress();
  console.log(
    "Underlying HTS NFT Collection (ERC721 facade) address:",
    tokenAddress
  );

  console.log("\n=== Deployment Summary ===");
  console.log("Contract Address:", contractAddress);
  console.log("Token Address:", tokenAddress);
  console.log("Save these addresses for minting and other operations!");
}

main().catch(console.error);