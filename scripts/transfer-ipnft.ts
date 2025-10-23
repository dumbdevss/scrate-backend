import { network } from "hardhat";
import type { ContractTransactionResponse } from "ethers";

const { ethers } = await network.connect({ network: "testnet" });

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Using signer:", signer.address);

  const contractAddress = "<your-contract-address>";
  const tokenId = BigInt("<your-token-id>");
  const toAddress = "<recipient-address>"; // Address to transfer to

  const hederaIpNft = await ethers.getContractAt(
    "HederaIpNft",
    contractAddress,
    signer
  );

  const tokenAddress = await hederaIpNft.tokenAddress();
  console.log("HTS ERC721 facade address:", tokenAddress);

  const erc721 = new ethers.Contract(
    tokenAddress,
    [
      "function ownerOf(uint256 tokenId) external view returns (address)",
      "function balanceOf(address owner) external view returns (uint256)"
    ],
    signer
  );

  // Verify ownership
  const owner = await erc721.ownerOf(tokenId);
  console.log("Current owner:", owner);
  
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error("Signer does not own this token");
  }

  // Check balances before
  const fromBalanceBefore = await erc721.balanceOf(signer.address);
  const toBalanceBefore = await erc721.balanceOf(toAddress);
  console.log("From balance before:", fromBalanceBefore.toString());
  console.log("To balance before:", toBalanceBefore.toString());

  // Transfer using contract's transferIpNFT function
  console.log(`Transferring token ${tokenId.toString()} to ${toAddress}...`);
  const tx = (await hederaIpNft.transferIpNFT(
    signer.address,
    toAddress,
    tokenId,
    {
      gasLimit: 200_000
    }
  )) as unknown as ContractTransactionResponse;
  await tx.wait();
  console.log("Transfer tx hash:", tx.hash);

  // Check balances after
  const fromBalanceAfter = await erc721.balanceOf(signer.address);
  const toBalanceAfter = await erc721.balanceOf(toAddress);
  console.log("From balance after:", fromBalanceAfter.toString());
  console.log("To balance after:", toBalanceAfter.toString());

  // Verify new owner
  const newOwner = await erc721.ownerOf(tokenId);
  console.log("New owner:", newOwner);
  console.log("Transfer successful!");
}

main().catch(console.error);
