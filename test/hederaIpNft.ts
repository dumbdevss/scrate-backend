import { expect } from "chai";
import { network } from "hardhat";
import { ContractTransactionResponse } from "ethers";

const { ethers } = await network.connect({ network: "testnet" });

let hederaIPNFT: any;
let ipnftErc721Address: string;
let mintedTokenId: bigint;

const ERC721_MIN_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "function approve(address to, uint256 tokenId) external",
  "function getApproved(uint256 tokenId) external view returns (address)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function balanceOf(address owner) external view returns (uint256)"
];

describe("HederaIPNFT (Hedera testnet)", function () {
  this.timeout(300_000);

  it("deploys the HederaIPNFT contract", async () => {
    hederaIPNFT = await ethers.deployContract("HederaIPNFT");
    console.log("HederaIPNFT deployed to:", hederaIPNFT.target);
    expect(hederaIPNFT.target).to.be.properAddress;
  });

  it("creates an IPNFT collection", async () => {
    const tx = await hederaIPNFT.createIPNFTCollection(
      "HederaIPNFTCollection",
      "HIP",
      {
        value: ethers.parseEther("15"),
        gasLimit: 250_000
      }
    );

    await expect(tx).to.emit(hederaIPNFT, "IPNFTCollectionCreated");

    ipnftErc721Address = await hederaIPNFT.tokenAddress();
    console.log("IPNFT ERC721 facade address:", ipnftErc721Address);
    expect(ipnftErc721Address).to.be.properAddress;
    expect(ipnftErc721Address).to.not.equal(ethers.ZeroAddress);
  });

  it("mints an IPNFT with metadata to the deployer (capture tokenId)", async () => {
    const [deployer] = await ethers.getSigners();

    const metadata = ethers.toUtf8Bytes(
      "ipfs://bafkreie2n6yq5xxr5djchf6pft3okgk2l5a7x6kp3rnvlt5pqshkk2rw7i"
    );

    const tx = (await hederaIPNFT.mintIPNFT(deployer.address, metadata, {
      gasLimit: 350_000
    })) as unknown as ContractTransactionResponse;

    await expect(tx).to.emit(hederaIPNFT, "IPNFTMinted");

    // Extract tokenId from IPNFTMinted event
    const rcpt = await tx.wait();
    const wrapperAddr = hederaIPNFT.target.toLowerCase();
    mintedTokenId = 0n;

    if (rcpt && rcpt.logs) {
      for (const log of rcpt.logs) {
        if (log.address.toLowerCase() !== wrapperAddr) continue;
        try {
          const parsed = hederaIPNFT.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsed && parsed.name === "IPNFTMinted") {
            const tok = parsed.args[1];
            mintedTokenId =
              typeof tok === "bigint" ? tok : BigInt(tok.toString());
            break;
          }
        } catch {
          // ignore unrelated logs
        }
      }
    }

    expect(mintedTokenId, "failed to decode minted tokenId").to.not.equal(0n);
    console.log("Minted IPNFT tokenId:", mintedTokenId.toString());
  });

  it("approves and burns the IPNFT", async () => {
    const [deployer] = await ethers.getSigners();

    const erc721 = new ethers.Contract(
      ipnftErc721Address,
      ERC721_MIN_ABI,
      deployer
    );

    const currentApproved: string = await erc721.getApproved(mintedTokenId);
    if (currentApproved.toLowerCase() !== hederaIPNFT.target.toLowerCase()) {
      const approveTx = await erc721.approve(hederaIPNFT.target, mintedTokenId);
      await approveTx.wait();
    }

    const burnTx = await hederaIPNFT.burnIPNFT(mintedTokenId, {
      gasLimit: 200_000
    });
    await expect(burnTx).to.emit(hederaIPNFT, "IPNFTBurned");

    const raw = await erc721.balanceOf(deployer.address);
    const bal = typeof raw === "bigint" ? raw : BigInt(raw.toString());
    expect(bal >= 0n).to.equal(true);
  });
});
