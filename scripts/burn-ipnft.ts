import { network } from "hardhat";
import type { ContractTransactionResponse } from "ethers";

const { ethers } = await network.connect({ network: "testnet" });

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Using signer:", signer.address);

  const contractAddress = "<your-contract-address>";
  const tokenId = BigInt("<your-token-id>"); // e.g., 1n, 2n, etc.

  const hederaIpNft = await ethers.getContractAt(
    "HederaIpNft",
    contractAddress,
    signer
  );

  const tokenAddress: string = await hederaIpNft.tokenAddress();
  console.log("HTS ERC721 facade address:", tokenAddress);

  // Minimal ERC721 ABI for approvals and balance
  const erc721 = new ethers.Contract(
    tokenAddress,
    [
      "function approve(address to, uint256 tokenId) external",
      "function getApproved(uint256 tokenId) external view returns (address)",
      "function ownerOf(uint256 tokenId) external view returns (address)",
      "function balanceOf(address owner) external view returns (uint256)"
    ],
    signer
  );

  const ownerOfToken: string = await erc721.ownerOf(tokenId);
  console.log("Current owner of token:", ownerOfToken);

  // Verify signer owns the token
  if (ownerOfToken.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error("Signer does not own this token");
  }

  // Check if already approved; if not, approve HederaIpNft contract
  const currentApproved: string = await erc721.getApproved(tokenId);
  if (currentApproved.toLowerCase() !== contractAddress.toLowerCase()) {
    console.log(
      `Approving HederaIpNft contract ${contractAddress} for tokenId ${tokenId.toString()}...`
    );
    const approveTx = (await erc721.approve(
      contractAddress,
      tokenId
    )) as unknown as ContractTransactionResponse;
    await approveTx.wait();
    console.log("Approval tx hash:", approveTx.hash);
  } else {
    console.log("HederaIpNft contract is already approved for this tokenId.");
  }

  // Get balance before burn
  const balanceBefore = (await erc721.balanceOf(signer.address)) as bigint;
  console.log("Balance before burn:", balanceBefore.toString(), "NFTs");

  // Burn via HederaIpNft
  console.log(`Burning tokenId ${tokenId.toString()}...`);
  const burnTx = (await hederaIpNft.burnNFT(tokenId, {
    gasLimit: 250_000
  })) as unknown as ContractTransactionResponse;
  await burnTx.wait();
  console.log("Burn tx hash:", burnTx.hash);

  // Show caller's balance after burn
  const balanceAfter = (await erc721.balanceOf(signer.address)) as bigint;
  console.log("Balance after burn:", balanceAfter.toString(), "NFTs");
  console.log(`Successfully burned ${balanceBefore - balanceAfter} NFT(s)`);
}

main().catch(console.error);
