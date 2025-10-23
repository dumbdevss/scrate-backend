import { network } from "hardhat";

const { ethers } = await network.connect({ network: "testnet" });

async function main() {
  const [signer] = await ethers.getSigners();
  
  const contractAddress = "<your-contract-address>";
  const tokenId = BigInt("<your-token-id>");

  const hederaIpNft = await ethers.getContractAt(
    "HederaIpNft",
    contractAddress,
    signer
  );

  console.log("=== IP NFT Metadata ===");
  console.log("Token ID:", tokenId.toString());

  // Get IP metadata
  const ipMetadata = await hederaIpNft.getIPMetadata(tokenId);
  console.log("\nIP Metadata:");
  console.log("  IPFS Hash:", ipMetadata.ipfsHash);
  console.log("  Description:", ipMetadata.description);
  console.log("  Creator:", ipMetadata.creator);
  console.log("  Category:", ipMetadata.category);
  console.log("  Creation Date:", new Date(Number(ipMetadata.creationDate) * 1000).toISOString());
  console.log("  Is Licensable:", ipMetadata.isLicensable);

  // Get license info if licensable
  if (ipMetadata.isLicensable) {
    const licenseInfo = await hederaIpNft.getLicenseInfo(tokenId);
    console.log("\nLicense Info:");
    console.log("  License Type:", licenseInfo.licenseType);
    console.log("  Price:", ethers.formatEther(licenseInfo.price), "HBAR");
    console.log("  Duration:", licenseInfo.duration.toString(), "seconds", 
                licenseInfo.duration === 0n ? "(perpetual)" : "");
    console.log("  Terms:", licenseInfo.terms);
    console.log("  Is Active:", licenseInfo.isActive);
  }

  // Get owner
  const owner = await hederaIpNft.ownerOf(tokenId);
  console.log("\nCurrent Owner:", owner);

  // Get all licenses for this token
  const licenses = await hederaIpNft.getTokenLicenses(tokenId);
  console.log("\nTotal Licenses Purchased:", licenses.length);
  if (licenses.length > 0) {
    console.log("\nLicense History:");
    licenses.forEach((license: any, idx: number) => {
      console.log(`  License ${idx + 1}:`);
      console.log("    Licensee:", license.licensee);
      console.log("    Purchase Date:", new Date(Number(license.purchaseDate) * 1000).toISOString());
      console.log("    Expiry Date:", license.expiryDate === 0n ? "Perpetual" : 
                  new Date(Number(license.expiryDate) * 1000).toISOString());
      console.log("    Type:", license.licenseType);
    });
  }
}

main().catch(console.error);