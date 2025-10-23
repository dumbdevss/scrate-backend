import { network } from "hardhat";

const { ethers } = await network.connect({ network: "testnet" });

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Using signer:", signer.address);

  const contractAddress = "<your-contract-address>";
  const recipient = signer.address;

  const hederaIpNft = await ethers.getContractAt(
    "HederaIpNft",
    contractAddress,
    signer
  );

  const tokenAddress = await hederaIpNft.tokenAddress();
  console.log("HTS ERC721 facade address:", tokenAddress);

  // 1) Associate recipient
  const tokenAssociateAbi = ["function associate()"];
  const token = new ethers.Contract(tokenAddress, tokenAssociateAbi, signer);
  
  console.log("Associating recipient to token...");
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

  // 2) Prepare simple metadata
  const metadata = ethers.hexlify(ethers.toUtf8Bytes("Simple NFT metadata"));
  
  // 3) Mint simple NFT (without IP metadata)
  console.log(`Minting simple NFT to ${recipient}...`);
  const tx = await hederaIpNft.mintNFT(
    recipient,
    metadata,
    {
      gasLimit: 350_000
    }
  );
  await tx.wait();
  console.log("Mint tx hash:", tx.hash);

  // Check balance
  const erc721 = new ethers.Contract(
    tokenAddress,
    ["function balanceOf(address owner) view returns (uint256)"],
    signer
  );
  const balance = (await erc721.balanceOf(recipient)) as bigint;
  console.log("Balance:", balance.toString(), "NFTs");
}

main().catch(console.error);