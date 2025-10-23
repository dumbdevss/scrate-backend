// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Admin/ownership like the OZ example
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
// Read/transfer via ERC721 facade exposed at the HTS token EVM address
import {IERC721} from "@openzeppelin/contracts/interfaces/IERC721.sol";

// Hedera HTS system contracts (v1, NOT v2)
import {HederaTokenService} from "@hashgraph/smart-contracts/contracts/system-contracts/hedera-token-service/HederaTokenService.sol";
import {IHederaTokenService} from "@hashgraph/smart-contracts/contracts/system-contracts/hedera-token-service/IHederaTokenService.sol";
import {HederaResponseCodes} from "@hashgraph/smart-contracts/contracts/system-contracts/HederaResponseCodes.sol";
import {KeyHelper} from "@hashgraph/smart-contracts/contracts/system-contracts/hedera-token-service/KeyHelper.sol";

/**
 * HTS-backed ERC721-like IP NFT collection:
 * - Creates the HTS NFT collection in the constructor (like deploying an ERC721).
 * - SUPPLY key = this contract (mint/burn only via contract).
 * - ADMIN key  = this contract (admin updates only via contract).
 * - Holders use the token's ERC721 facade directly (SDK or EVM).
 * - Royalty: configurable with HBAR fallback.
 * - IP metadata tracking and licensing system.
 */
contract HederaIpNft is HederaTokenService, KeyHelper, Ownable {
    // Underlying HTS NFT token EVM address
    address public tokenAddress;

    // Collection metadata
    string public name;
    string public symbol;

    // Royalty configuration
    uint256 public royaltyNumerator;
    uint256 public royaltyDenominator;
    uint256 public royaltyFallbackFee;
    address public royaltyCollector;

    // Constants
    bytes private constant DEFAULT_METADATA = hex"01";
    uint256 private constant INT64_MAX = 0x7fffffffffffffff;
    uint256 private constant MAX_ROYALTY_BASIS_POINTS = 5000; // Maximum 50%
    uint256 private constant BASIS_POINTS_DENOMINATOR = 10000;
    uint256 private constant DEFAULT_FALLBACK_FEE = 100_000_000; // 1 HBAR in tinybars

    // IP NFT specific structures
    struct IPMetadata {
        string ipfsHash;           // IPFS hash for content
        string description;        // IP description
        address creator;           // Original creator
        string category;           // IP category (art, music, etc.)
        uint256 creationDate;      // Creation timestamp
        bool isLicensable;         // Whether IP can be licensed
    }
    
    struct LicenseInfo {
        string licenseType;        // Type of license (commercial, personal, etc.)
        uint256 price;             // License price in wei
        uint256 duration;          // License duration in seconds (0 = perpetual)
        string terms;              // License terms
        bool isActive;             // Whether license is available
    }

    struct License {
        address licensee;          // Who holds the license
        uint256 purchaseDate;      // When license was purchased
        uint256 expiryDate;        // When license expires (0 = perpetual)
        string licenseType;        // Type of license purchased
    }

    // Mappings
    mapping(uint256 => IPMetadata) public ipMetadata;
    mapping(uint256 => LicenseInfo) public licenseInfo;
    mapping(uint256 => License[]) public tokenLicenses;
    mapping(uint256 => mapping(address => bool)) public hasActiveLicense;

    // Events
    event IPNFTCollectionCreated(
        address indexed token, 
        string name, 
        string symbol,
        uint256 royaltyBasisPoints,
        address royaltyCollector
    );

    event IPNFTMinted(
        address indexed to,
        uint256 indexed tokenId,
        address indexed creator,
        string ipfsHash,
        string licenseType,
        uint256 licensePrice
    );

    event IpNftBurned(uint256 indexed tokenId, int64 newTotalSupply);
    
    event LicensePurchased(
        uint256 indexed tokenId,
        address indexed licensee,
        uint256 price,
        uint256 duration
    );
    
    event LicenseUpdated(uint256 indexed tokenId, string licenseType, uint256 price);
    event HBARReceived(address indexed from, uint256 amount);
    event HBARWithdrawn(address indexed to, uint256 amount);
    event RoyaltyUpdated(uint256 basisPoints, address collector, uint256 fallbackFee);
    event HBARFallback(address sender, uint256 amount, bytes data);
    event IPMetadataUpdated(uint256 indexed tokenId, string ipfsHash, string description);

    /**
     * Constructor sets ownership.
     * Actual HTS token creation happens in createIpNftCollection().
     */
    constructor() Ownable(msg.sender) {}

    /**
     * Creates the HTS NFT collection with custom fees.
     * Can be called exactly once by the owner after deployment.
     *
     * @param _name         Token/collection name
     * @param _symbol       Token/collection symbol
     * @param _royaltyBasisPoints Royalty in basis points (100 = 1%)
     * @param _royaltyCollector Address to receive royalties
     */
    function createIpNftCollection(
        string memory _name,
        string memory _symbol,
        uint256 _royaltyBasisPoints,
        address _royaltyCollector
    ) external payable onlyOwner {
        require(tokenAddress == address(0), "Already initialized");
        require(_royaltyBasisPoints <= MAX_ROYALTY_BASIS_POINTS, "Royalty too high");
        require(_royaltyCollector != address(0), "Invalid collector");

        name = _name;
        symbol = _symbol;
        royaltyNumerator = _royaltyBasisPoints;
        royaltyDenominator = BASIS_POINTS_DENOMINATOR;
        royaltyFallbackFee = DEFAULT_FALLBACK_FEE;
        royaltyCollector = _royaltyCollector;

        // Build token definition
        IHederaTokenService.HederaToken memory token;
        token.name = name;
        token.symbol = symbol;
        token.treasury = address(this);
        token.memo = "";

        // Keys: SUPPLY + ADMIN -> contractId
        IHederaTokenService.TokenKey[]
            memory keys = new IHederaTokenService.TokenKey[](2);
        keys[0] = getSingleKey(
            KeyType.SUPPLY,
            KeyValueType.CONTRACT_ID,
            address(this)
        );
        keys[1] = getSingleKey(
            KeyType.ADMIN,
            KeyValueType.CONTRACT_ID,
            address(this)
        );
        token.tokenKeys = keys;

        // Royalty configuration
        IHederaTokenService.RoyaltyFee[]
            memory royaltyFees = new IHederaTokenService.RoyaltyFee[](1);
        royaltyFees[0] = IHederaTokenService.RoyaltyFee({
            numerator: _toI64(royaltyNumerator),
            denominator: _toI64(royaltyDenominator),
            amount: _toI64(royaltyFallbackFee),
            tokenId: address(0),
            useHbarsForPayment: true,
            feeCollector: royaltyCollector 
        });

        IHederaTokenService.FixedFee[]
            memory fixedFees = new IHederaTokenService.FixedFee[](0);

        (int rc, address created) = createNonFungibleTokenWithCustomFees(
            token,
            fixedFees,
            royaltyFees
        );
        require(rc == HederaResponseCodes.SUCCESS, "HTS: create NFT failed");
        tokenAddress = created;

        emit IPNFTCollectionCreated(created, name, symbol, _royaltyBasisPoints, royaltyCollector);
    }

    // ---------------------------------------------------------------------------
    // IP NFT Minting with full metadata
    // ---------------------------------------------------------------------------

    /**
     * Mint an IP NFT with full metadata and licensing information
     * @param to Recipient address
     * @param metadata On-chain metadata bytes (<= 100 bytes for HTS)
     * @param ipfsHash IPFS hash of the IP content
     * @param description Description of the IP
     * @param category Category (art, music, etc.)
     * @param isLicensable Whether the IP can be licensed
     * @param licenseType Type of license available
     * @param licensePrice Price for license in wei
     * @param licenseDuration Duration in seconds (0 = perpetual)
     * @param licenseTerms License terms
     */
    function mintIpNFT(
        address to,
        bytes memory metadata,
        string memory ipfsHash,
        string memory description,
        string memory category,
        bool isLicensable,
        string memory licenseType,
        uint256 licensePrice,
        uint256 licenseDuration,
        string memory licenseTerms
    ) external onlyOwner returns (uint256) {
        require(tokenAddress != address(0), "HTS: not created");
        require(metadata.length > 0 && metadata.length <= 100, "Metadata must be 1-100 bytes");
        require(bytes(ipfsHash).length > 0, "IPFS hash required");
        require(to != address(0), "Invalid recipient");

        // Mint the token with provided metadata
        uint256 tokenId = _mintAndSend(to, metadata);

        // Store IP metadata
        ipMetadata[tokenId] = IPMetadata({
            ipfsHash: ipfsHash,
            description: description,
            creator: to,
            category: category,
            creationDate: block.timestamp,
            isLicensable: isLicensable
        });

        // Store license information if licensable
        if (isLicensable) {
            licenseInfo[tokenId] = LicenseInfo({
                licenseType: licenseType,
                price: licensePrice,
                duration: licenseDuration,
                terms: licenseTerms,
                isActive: true
            });
        }

        emit IPNFTMinted(to, tokenId, to, ipfsHash, licenseType, licensePrice);
        return tokenId;
    }

    /**
     * Simple mint function with custom metadata
     * @param to Recipient address
     * @param metadata On-chain metadata bytes (<= 100 bytes for HTS)
     */
    function mintNFT(address to, bytes memory metadata) external onlyOwner returns (uint256) {
        require(to != address(0), "Invalid recipient");
        require(metadata.length > 0 && metadata.length <= 100, "Metadata must be 1-100 bytes");
        return _mintAndSend(to, metadata);
    }

    /**
     * Internal mint helper
     * @param to Recipient address
     * @param metadata On-chain metadata bytes to store with the token
     */
    function _mintAndSend(
        address to,
        bytes memory metadata
    ) internal returns (uint256 tokenId) {
        require(tokenAddress != address(0), "HTS: not created");
        require(metadata.length <= 100, "HTS: metadata >100 bytes");

        // 1) Mint to treasury (this contract) with provided metadata
        bytes[] memory metadataArray = new bytes[](1);
        metadataArray[0] = metadata;
        (int rc, , int64[] memory serials) = mintToken(
            tokenAddress,
            0,
            metadataArray
        );
        require(
            rc == HederaResponseCodes.SUCCESS && serials.length == 1,
            "HTS: mint failed"
        );

        // 2) Transfer from treasury -> recipient via ERC721 facade
        uint256 serial = uint256(uint64(serials[0]));
        IERC721(tokenAddress).transferFrom(address(this), to, serial);

        return serial;
    }

    // ---------------------------------------------------------------------------
    // Burning functionality
    // ---------------------------------------------------------------------------

    /**
     * Burn an IP NFT
     * Can be called by token owner or approved operator
     * @param tokenId The token ID to burn
     */
    function burnNFT(uint256 tokenId) external {
        require(tokenAddress != address(0), "HTS: not created");

        address owner_ = IERC721(tokenAddress).ownerOf(tokenId);

        // Check if caller is authorized
        require(
            msg.sender == owner_ ||
                IERC721(tokenAddress).getApproved(tokenId) == msg.sender ||
                IERC721(tokenAddress).isApprovedForAll(owner_, msg.sender),
            "caller not owner nor approved"
        );

        // Transfer to treasury if not already there
        if (owner_ != address(this)) {
            bool contractApproved = IERC721(tokenAddress).getApproved(tokenId) == address(this) ||
                IERC721(tokenAddress).isApprovedForAll(owner_, address(this));
            require(contractApproved, "contract not approved to transfer");
            IERC721(tokenAddress).transferFrom(owner_, address(this), tokenId);
        }

        // Burn via HTS
        int64[] memory serials = new int64[](1);
        serials[0] = _toI64(tokenId);
        (int rc, int64 newTotalSupply) = burnToken(tokenAddress, 0, serials);
        require(rc == HederaResponseCodes.SUCCESS, "HTS: burn failed");

        // Clean up metadata
        delete ipMetadata[tokenId];
        delete licenseInfo[tokenId];
        delete tokenLicenses[tokenId];

        emit IpNftBurned(tokenId, newTotalSupply);
    }

    // ---------------------------------------------------------------------------
    // Transfer functions (use ERC721 facade directly)
    // ---------------------------------------------------------------------------

    /**
     * Transfer an IP NFT to another address
     * Note: Users can also call transferFrom directly on the token contract
     * @param from Current owner
     * @param to New owner
     * @param tokenId Token to transfer
     */
    function transferIpNFT(address from, address to, uint256 tokenId) external {
        require(tokenAddress != address(0), "HTS: not created");
        require(to != address(0), "Invalid recipient");
        
        // Transfer using ERC721 facade
        IERC721(tokenAddress).transferFrom(from, to, tokenId);
    }

    /**
     * Safe transfer with data
     */
    function safeTransferIpNFT(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) external {
        require(tokenAddress != address(0), "HTS: not created");
        require(to != address(0), "Invalid recipient");
        
        // Safe transfer using ERC721 facade
        IERC721(tokenAddress).safeTransferFrom(from, to, tokenId, data);
    }

    // ---------------------------------------------------------------------------
    // Licensing functionality
    // ---------------------------------------------------------------------------

    /**
     * Purchase a license for an IP NFT
     * @param tokenId The token ID to license
     */
    function purchaseLicense(uint256 tokenId) external payable {
        require(tokenAddress != address(0), "HTS: not created");
        require(ipMetadata[tokenId].isLicensable, "Not licensable");
        require(licenseInfo[tokenId].isActive, "License not active");
        require(!hasActiveLicense[tokenId][msg.sender], "Already licensed");
        require(msg.value >= licenseInfo[tokenId].price, "Insufficient payment");

        LicenseInfo memory info = licenseInfo[tokenId];
        uint256 expiryDate = info.duration == 0 ? 0 : block.timestamp + info.duration;

        // Record the license
        tokenLicenses[tokenId].push(License({
            licensee: msg.sender,
            purchaseDate: block.timestamp,
            expiryDate: expiryDate,
            licenseType: info.licenseType
        }));

        hasActiveLicense[tokenId][msg.sender] = true;

        // Transfer payment to creator
        address creator = ipMetadata[tokenId].creator;
        (bool success, ) = creator.call{value: msg.value}("");
        require(success, "Payment failed");

        emit LicensePurchased(tokenId, msg.sender, msg.value, info.duration);
    }

    /**
     * Update license information for a token (owner only)
     */
    function updateLicense(
        uint256 tokenId,
        string memory licenseType,
        uint256 price,
        uint256 duration,
        string memory terms,
        bool isActive
    ) external {
        require(tokenAddress != address(0), "HTS: not created");
        address owner_ = IERC721(tokenAddress).ownerOf(tokenId);
        require(msg.sender == owner_, "Not token owner");
        require(ipMetadata[tokenId].isLicensable, "Not licensable");

        licenseInfo[tokenId] = LicenseInfo({
            licenseType: licenseType,
            price: price,
            duration: duration,
            terms: terms,
            isActive: isActive
        });

        emit LicenseUpdated(tokenId, licenseType, price);
    }

    /**
     * Update IP metadata (owner only)
     */
    function updateIPMetadata(
        uint256 tokenId,
        string memory ipfsHash,
        string memory description
    ) external {
        require(tokenAddress != address(0), "HTS: not created");
        address owner_ = IERC721(tokenAddress).ownerOf(tokenId);
        require(msg.sender == owner_, "Not token owner");

        ipMetadata[tokenId].ipfsHash = ipfsHash;
        ipMetadata[tokenId].description = description;

        emit IPMetadataUpdated(tokenId, ipfsHash, description);
    }

    // ---------------------------------------------------------------------------
    // View functions
    // ---------------------------------------------------------------------------

    /**
     * Get IP metadata for a token
     */
    function getIPMetadata(uint256 tokenId) external view returns (IPMetadata memory) {
        return ipMetadata[tokenId];
    }

    /**
     * Get license info for a token
     */
    function getLicenseInfo(uint256 tokenId) external view returns (LicenseInfo memory) {
        return licenseInfo[tokenId];
    }

    /**
     * Get all licenses for a token
     */
    function getTokenLicenses(uint256 tokenId) external view returns (License[] memory) {
        return tokenLicenses[tokenId];
    }

    /**
     * Check if an address has an active license
     */
    function checkActiveLicense(uint256 tokenId, address licensee) external view returns (bool) {
        if (!hasActiveLicense[tokenId][licensee]) {
            return false;
        }

        // Check if license has expired
        License[] memory licenses = tokenLicenses[tokenId];
        for (uint i = 0; i < licenses.length; i++) {
            if (licenses[i].licensee == licensee) {
                if (licenses[i].expiryDate == 0) {
                    return true; // Perpetual license
                }
                return block.timestamp < licenses[i].expiryDate;
            }
        }
        return false;
    }

    /**
     * Get token owner
     */
    function ownerOf(uint256 tokenId) external view returns (address) {
        require(tokenAddress != address(0), "HTS: not created");
        return IERC721(tokenAddress).ownerOf(tokenId);
    }

    // ---------------------------------------------------------------------------
    // Royalty management
    // ---------------------------------------------------------------------------

    /**
     * Update royalty configuration (owner only)
     */
    function updateRoyalty(
        uint256 basisPoints,
        address collector,
        uint256 fallbackFee
    ) external onlyOwner {
        require(basisPoints <= MAX_ROYALTY_BASIS_POINTS, "Royalty too high");
        require(collector != address(0), "Invalid collector");

        royaltyNumerator = basisPoints;
        royaltyCollector = collector;
        royaltyFallbackFee = fallbackFee;

        emit RoyaltyUpdated(basisPoints, collector, fallbackFee);
    }

    // ---------------------------------------------------------------------------
    // HBAR handling
    // ---------------------------------------------------------------------------

    receive() external payable {
        emit HBARReceived(msg.sender, msg.value);
    }

    fallback() external payable {
        emit HBARFallback(msg.sender, msg.value, msg.data);
    }

    function withdrawHBAR() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No HBAR to withdraw");
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Failed to withdraw HBAR");
        emit HBARWithdrawn(owner(), balance);
    }

    // ---------------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------------

    function _toI64(uint256 x) internal pure returns (int64) {
        require(x <= INT64_MAX, "cast: > int64.max");
        return int64(uint64(x));
    }
}