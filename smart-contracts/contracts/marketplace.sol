// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/hederaIpNft.sol";

contract HederaIpNftTest is Test {
    HederaIpNft public ipnft;
    address public owner = address(0xABCD);
    address public user1 = address(0x1111);
    address public user2 = address(0x2222);

    function setUp() public {
        vm.prank(owner);
        ipnft = new HederaIpNft();
    }

    function testOwnerIsCorrect() public {
        assertEq(ipnft.owner(), owner);
    }

    function testCreateCollection() public {
        vm.startPrank(owner);
        ipnft.createIpNftCollection(
            "HederaIP",
            "HIP",
            500, // 5%
            address(0x9999)
        );

        assertEq(ipnft.name(), "HederaIP");
        assertEq(ipnft.symbol(), "HIP");
        assertEq(ipnft.royaltyNumerator(), 500);
        assertEq(ipnft.royaltyCollector(), address(0x9999));
        vm.stopPrank();
    }

    function testFailCreateCollectionTwice() public {
        vm.startPrank(owner);
        ipnft.createIpNftCollection("HederaIP", "HIP", 100, address(0x9999));
        ipnft.createIpNftCollection("Again", "AG", 100, address(0x9999)); // should revert
        vm.stopPrank();
    }

    function testMintIpNftStoresMetadata() public {
        vm.startPrank(owner);
        ipnft.createIpNftCollection("HederaIP", "HIP", 100, address(0x9999));
        uint256 tokenId = ipnft.mintIpNFT(
            user1,
            hex"01",
            "QmExampleHash",
            "IP Asset 1",
            "art",
            true,
            "commercial",
            1 ether,
            3600,
            "One-hour license"
        );

        HederaIpNft.IPMetadata memory meta = ipnft.getIPMetadata(tokenId);
        assertEq(meta.ipfsHash, "QmExampleHash");
        assertEq(meta.creator, user1);
        assertTrue(meta.isLicensable);
        vm.stopPrank();
    }

    function testUpdateLicenseInfo() public {
        vm.startPrank(owner);
        ipnft.createIpNftCollection("HederaIP", "HIP", 100, address(0x9999));
        uint256 tokenId = ipnft.mintIpNFT(
            owner,
            hex"02",
            "QmAnother",
            "Testing License",
            "music",
            true,
            "personal",
            1 ether,
            0,
            "Forever"
        );
        vm.stopPrank();

        vm.prank(owner);
        ipnft.updateLicense(
            tokenId,
            "commercial",
            2 ether,
            7200,
            "Updated terms",
            true
        );

        HederaIpNft.LicenseInfo memory info = ipnft.getLicenseInfo(tokenId);
        assertEq(info.price, 2 ether);
        assertEq(info.duration, 7200);
        assertEq(info.licenseType, "commercial");
    }

    function testUpdateIPMetadata() public {
        vm.startPrank(owner);
        ipnft.createIpNftCollection("HederaIP", "HIP", 100, address(0x9999));
        uint256 tokenId = ipnft.mintIpNFT(
            owner,
            hex"03",
            "QmOld",
            "Old Desc",
            "music",
            false,
            "",
            0,
            0,
            ""
        );
        vm.stopPrank();

        vm.prank(owner);
        ipnft.updateIPMetadata(tokenId, "QmNewHash", "Updated Description");

        HederaIpNft.IPMetadata memory meta = ipnft.getIPMetadata(tokenId);
        assertEq(meta.ipfsHash, "QmNewHash");
        assertEq(meta.description, "Updated Description");
    }
}
