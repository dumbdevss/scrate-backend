import { network } from "hardhat";

const { ethers } = await network.connect({ network: "testnet" });

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Using signer:", signer.address);

  // CONFIGURE THESE
  const contractAddress = "<your-contract-address>"; // From deployment
  const recipient = signer.address; // Or another address

  const hederaIpNft = await ethers.getContractAt(
    "HederaIpNft",
    contractAddress,
    signer
  );

  // Display the underlying HTS token address
  const tokenAddress = await hederaIpNft.tokenAddress();
  console.log("HTS ERC721 facade address:", tokenAddress);

  // 1) Associate the recipient to the token (if not already associated)
  const tokenAssociateAbi = ["function associate()"];
  const token = new ethers.Contract(tokenAddress, tokenAssociateAbi, signer);
  
  console.log(`Associating ${recipient} to token via token.associate() ...`);
  try {
    const assocTx = await token.associate({ gasLimit: 800_000 });
    await assocTx.wait();
    console.log("Associate tx hash:", assocTx.hash);
  } catch (error: any) {
    if (error.message?.includes("TOKEN_ALREADY_ASSOCIATED")) {
      console.log("Already associated, continuing...");
    } else {
      throw error;
    }
  }

  // 2) Prepare metadata (<= 100 bytes for HTS)
  const metadataString = "ipfs://QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
  const metadata = ethers.hexlify(ethers.toUtf8Bytes(metadataString));
  const byteLen = ethers.getBytes(metadata).length;
  
  console.log(`Metadata string: ${metadataString}`);
  console.log(`Metadata bytes length: ${byteLen}`);
  
  if (byteLen > 100) {
    throw new Error(
      `Metadata is ${byteLen} bytes; must be <= 100 bytes for HTS`
    );
  }

  // 3) IP Metadata
  const ipfsHash = "QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
  const description = "Original digital artwork";
  const category = "art";
  const isLicensable = true;
  const licenseType = "commercial";
  const licensePrice = ethers.parseEther("1"); // 1 HBAR
  const licenseDuration = 0; // 0 = perpetual
  const licenseTerms = "Full commercial rights with attribution";

  // 4) Mint the IP NFT
  console.log(`Minting IP NFT to ${recipient}...`);
  console.log(`  IPFS Hash: ${ipfsHash}`);
  console.log(`  Category: ${category}`);
  console.log(`  License Type: ${licenseType}`);
  console.log(`  License Price: ${ethers.formatEther(licensePrice)} HBAR`);

  const tx = await hederaIpNft.mintIpNFT(
    recipient,
    metadata,
    ipfsHash,
    description,
    category,
    isLicensable,
    licenseType,
    licensePrice,
    licenseDuration,
    licenseTerms,
    {
      gasLimit: 400_000
    }
  );
  
  const receipt = await tx.wait();
  console.log("Mint tx hash:", tx.hash);

  // Extract tokenId from events
  const mintEvent = receipt?.logs
    .map((log: any) => {
      try {
        return hederaIpNft.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((event: any) => event?.name === "IPNFTMinted");

  if (mintEvent) {
    console.log("Token ID minted:", mintEvent.args.tokenId.toString());
  }

  // Check recipient's NFT balance
  const erc721 = new ethers.Contract(
    tokenAddress,
    ["function balanceOf(address owner) view returns (uint256)"],
    signer
  );
  const balance = (await erc721.balanceOf(recipient)) as bigint;
  console.log("Recipient balance:", balance.toString(), "NFTs");
}

main().catch(console.error);
