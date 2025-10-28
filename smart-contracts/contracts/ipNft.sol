// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IPNFT
 * @dev ERC-721 based Intellectual Property NFT contract
 * Supports minting, transferring, and burning of IP-NFTs with metadata
 */
contract IPNFT is ERC721, ERC721URIStorage, ERC721Burnable, Ownable, ReentrancyGuard {
    uint256 private _tokenIdCounter;
    
    // Mapping from token ID to IP metadata
    mapping(uint256 => IPMetadata) public ipMetadata;
    
    // Mapping from creator to their created tokens
    mapping(address => uint256[]) public creatorTokens;
    
    // Mapping to track authorized minters
    mapping(address => bool) public authorizedMinters;
    
    struct IPMetadata {
        string title;
        string description;
        string ipType; // Patent, Trademark, Copyright, Trade Secret, etc.
        address creator;
        uint256 createdAt;
        string[] tags;
        bytes32 contentHash; // Hash of the IP content for verification
        bool isActive;
        bytes metadataBytes; // Raw metadata bytes (usually IPFS hash or JSON)
        string schemaVersion; // Schema version for metadata compatibility
        string externalUrl; // External URL for additional information
        string imageUrl; // Image URL for the NFT
    }
    
    // Events
    event IPNFTMinted(
        uint256 indexed tokenId,
        address indexed creator,
        address indexed to,
        string title,
        string ipType,
        string tokenURI
    );
    
    event IPNFTBurned(
        uint256 indexed tokenId,
        address indexed owner
    );
    
    event MinterAuthorized(address indexed minter);
    event MinterRevoked(address indexed minter);
    
    modifier onlyAuthorizedMinter() {
        require(
            authorizedMinters[msg.sender] || msg.sender == owner(),
            "Not authorized to mint"
        );
        _;
    }
    
    modifier tokenExists(uint256 tokenId) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        _;
    }

    /**
     * @dev Check if spender is owner or approved for tokenId
     */
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address owner = _ownerOf(tokenId);
        require(owner != address(0), "ERC721: operator query for nonexistent token");
        return (spender == owner || getApproved(tokenId) == spender || isApprovedForAll(owner, spender));
    }

    constructor(
        string memory name,
        string memory symbol
    ) ERC721(name, symbol) Ownable(msg.sender) {
        // Owner is automatically an authorized minter
        authorizedMinters[msg.sender] = true;
    }
    
    /**
     * @dev Mint a new IP-NFT
     * @param to Address to mint the token to
     * @param title Title of the intellectual property
     * @param description Description of the IP
     * @param ipType Type of IP (Patent, Trademark, etc.)
     * @param uri URI pointing to token metadata
     * @param tags Array of tags for categorization
     * @param contentHash Hash of the IP content for verification
     */
    function mint(
        address to,
        string memory title,
        string memory description,
        string memory ipType,
        string memory uri,
        string[] memory tags,
        bytes32 contentHash
    ) external onlyAuthorizedMinter nonReentrant returns (uint256) {
        return _mintWithMetadata(
            to,
            title,
            description,
            ipType,
            uri,
            tags,
            contentHash,
            "",
            "1.0.0",
            "",
            ""
        );
    }

    /**
     * @dev Mint a new IP-NFT with full metadata support
     * @param to Address to mint the token to
     * @param title Title of the intellectual property
     * @param description Description of the IP
     * @param ipType Type of IP (Patent, Trademark, etc.)
     * @param uri URI pointing to token metadata
     * @param tags Array of tags for categorization
     * @param contentHash Hash of the IP content for verification
     * @param metadataBytes Raw metadata bytes (IPFS hash, JSON, etc.)
     * @param schemaVersion Schema version for metadata compatibility
     * @param externalUrl External URL for additional information
     * @param imageUrl Image URL for the NFT
     */
    function mintWithMetadata(
        address to,
        string memory title,
        string memory description,
        string memory ipType,
        string memory uri,
        string[] memory tags,
        bytes32 contentHash,
        bytes memory metadataBytes,
        string memory schemaVersion,
        string memory externalUrl,
        string memory imageUrl
    ) external onlyAuthorizedMinter nonReentrant returns (uint256) {
        return _mintWithMetadata(
            to,
            title,
            description,
            ipType,
            uri,
            tags,
            contentHash,
            metadataBytes,
            schemaVersion,
            externalUrl,
            imageUrl
        );
    }

    /**
     * @dev Internal mint function with full metadata support
     */
    function _mintWithMetadata(
        address to,
        string memory title,
        string memory description,
        string memory ipType,
        string memory uri,
        string[] memory tags,
        bytes32 contentHash,
        bytes memory metadataBytes,
        string memory schemaVersion,
        string memory externalUrl,
        string memory imageUrl
    ) internal returns (uint256) {
        require(to != address(0), "Cannot mint to zero address");
        require(bytes(title).length > 0, "Title cannot be empty");
        require(bytes(ipType).length > 0, "IP type cannot be empty");
        require(bytes(uri).length > 0, "Token URI cannot be empty");
        require(contentHash != bytes32(0), "Content hash cannot be empty");
        
        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;
        
        // Mint the token
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        
        // Store IP metadata
        ipMetadata[tokenId] = IPMetadata({
            title: title,
            description: description,
            ipType: ipType,
            creator: msg.sender,
            createdAt: block.timestamp,
            tags: tags,
            contentHash: contentHash,
            isActive: true,
            metadataBytes: metadataBytes,
            schemaVersion: schemaVersion,
            externalUrl: externalUrl,
            imageUrl: imageUrl
        });
        
        // Track creator's tokens
        creatorTokens[msg.sender].push(tokenId);
        
        emit IPNFTMinted(tokenId, msg.sender, to, title, ipType, uri);
        
        return tokenId;
    }
    
    /**
     * @dev Burn an IP-NFT (only token owner or approved)
     * @param tokenId Token ID to burn
     */
    function burn(uint256 tokenId) public override tokenExists(tokenId) {
        require(
            _isApprovedOrOwner(msg.sender, tokenId),
            "Not owner nor approved"
        );
        
        address tokenOwner = ownerOf(tokenId);
        
        // Mark metadata as inactive
        ipMetadata[tokenId].isActive = false;
        
        // Burn the token
        _burn(tokenId);
        
        emit IPNFTBurned(tokenId, tokenOwner);
    }
    
    /**
     * @dev Transfer token (override to add custom logic if needed)
     */
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override(ERC721, IERC721) {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not owner nor approved");
        require(to != address(0), "Cannot transfer to zero address");
        
        _transfer(from, to, tokenId);
    }
    
    /**
     * @dev Safe transfer with data
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public override(ERC721, IERC721) {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not owner nor approved");
        require(to != address(0), "Cannot transfer to zero address");
        
        _safeTransfer(from, to, tokenId, data);
    }
    
    /**
     * @dev Authorize a new minter (only owner)
     */
    function authorizeMinter(address minter) external onlyOwner {
        require(minter != address(0), "Invalid minter address");
        require(!authorizedMinters[minter], "Already authorized");
        
        authorizedMinters[minter] = true;
        emit MinterAuthorized(minter);
    }
    
    /**
     * @dev Revoke minter authorization (only owner)
     */
    function revokeMinter(address minter) external onlyOwner {
        require(authorizedMinters[minter], "Not authorized");
        require(minter != owner(), "Cannot revoke owner");
        
        authorizedMinters[minter] = false;
        emit MinterRevoked(minter);
    }
    
    /**
     * @dev Update token URI (only token owner or approved)
     */
    function updateTokenURI(
        uint256 tokenId,
        string memory newTokenURI
    ) external tokenExists(tokenId) {
        require(
            _isApprovedOrOwner(msg.sender, tokenId),
            "Not owner nor approved"
        );
        require(bytes(newTokenURI).length > 0, "URI cannot be empty");
        
        _setTokenURI(tokenId, newTokenURI);
    }

    /**
     * @dev Update metadata bytes (only token owner or approved)
     */
    function updateMetadataBytes(
        uint256 tokenId,
        bytes memory newMetadataBytes
    ) external tokenExists(tokenId) {
        require(
            _isApprovedOrOwner(msg.sender, tokenId),
            "Not owner nor approved"
        );
        
        ipMetadata[tokenId].metadataBytes = newMetadataBytes;
    }

    /**
     * @dev Update external URL (only token owner or approved)
     */
    function updateExternalUrl(
        uint256 tokenId,
        string memory newExternalUrl
    ) external tokenExists(tokenId) {
        require(
            _isApprovedOrOwner(msg.sender, tokenId),
            "Not owner nor approved"
        );
        
        ipMetadata[tokenId].externalUrl = newExternalUrl;
    }

    /**
     * @dev Update image URL (only token owner or approved)
     */
    function updateImageUrl(
        uint256 tokenId,
        string memory newImageUrl
    ) external tokenExists(tokenId) {
        require(
            _isApprovedOrOwner(msg.sender, tokenId),
            "Not owner nor approved"
        );
        
        ipMetadata[tokenId].imageUrl = newImageUrl;
    }
    
    /**
     * @dev Get IP metadata for a token
     */
    function getIPMetadata(uint256 tokenId) 
        external 
        view 
        tokenExists(tokenId) 
        returns (IPMetadata memory) 
    {
        return ipMetadata[tokenId];
    }
    
    /**
     * @dev Get tokens created by a specific creator
     */
    function getCreatorTokens(address creator) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return creatorTokens[creator];
    }
    
    /**
     * @dev Get total number of tokens minted
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }
    
    /**
     * @dev Check if a token exists
     */
    function exists(uint256 tokenId) external view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
    
    /**
     * @dev Get tokens owned by an address
     */
    function getOwnedTokens(address owner) external view returns (uint256[] memory) {
        uint256 tokenCount = balanceOf(owner);
        uint256[] memory tokens = new uint256[](tokenCount);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= _tokenIdCounter; i++) {
            if (_ownerOf(i) != address(0) && ownerOf(i) == owner) {
                tokens[index] = i;
                index++;
            }
        }
        
        return tokens;
    }
    
    /**
     * @dev Verify IP content hash
     */
    function verifyContentHash(
        uint256 tokenId,
        bytes32 providedHash
    ) external view tokenExists(tokenId) returns (bool) {
        return ipMetadata[tokenId].contentHash == providedHash;
    }
    
    // Override required functions
    
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    
    // Compatibility functions for marketplace integration
    
    /**
     * @dev Get token owner by token ID (for marketplace compatibility)
     * Returns the owner address as expected by marketplace contracts
     */
    function getTokenOwner(uint256 tokenId) external view tokenExists(tokenId) returns (address) {
        return ownerOf(tokenId);
    }
    
    /**
     * @dev Transfer NFT with marketplace-compatible signature
     * This function provides compatibility with marketplace contracts expecting HTS-style transfers
     */
    function transferNFT(
        address from,
        address to,
        uint256 tokenId
    ) external returns (bool) {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not owner nor approved");
        require(to != address(0), "Cannot transfer to zero address");
        
        _transfer(from, to, tokenId);
        return true;
    }
    
    /**
     * @dev Approve marketplace contract to transfer tokens
     * Enhanced approval function for marketplace integration
     */
    function approveMarketplace(address marketplace, uint256 tokenId) external {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not owner nor approved");
        approve(marketplace, tokenId);
    }
    
    /**
     * @dev Set approval for all tokens to marketplace
     */
    function setMarketplaceApprovalForAll(address marketplace, bool approved) external {
        setApprovalForAll(marketplace, approved);
    }
    
    /**
     * @dev Check if marketplace is approved for token
     */
    function isMarketplaceApproved(address marketplace, uint256 tokenId) 
        external 
        view 
        tokenExists(tokenId) 
        returns (bool) 
    {
        address owner = ownerOf(tokenId);
        return (getApproved(tokenId) == marketplace || isApprovedForAll(owner, marketplace));
    }
    
    /**
     * @dev Batch mint function for efficiency
     */
    function batchMint(
        address[] memory recipients,
        string[] memory titles,
        string[] memory descriptions,
        string[] memory ipTypes,
        string[] memory tokenURIs,
        bytes32[] memory contentHashes
    ) external onlyAuthorizedMinter nonReentrant returns (uint256[] memory) {
        require(recipients.length == titles.length, "Array length mismatch");
        require(recipients.length == descriptions.length, "Array length mismatch");
        require(recipients.length == ipTypes.length, "Array length mismatch");
        require(recipients.length == tokenURIs.length, "Array length mismatch");
        require(recipients.length == contentHashes.length, "Array length mismatch");
        require(recipients.length > 0, "Empty arrays");
        require(recipients.length <= 50, "Batch too large"); // Limit batch size
        
        uint256[] memory tokenIds = new uint256[](recipients.length);
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Cannot mint to zero address");
            require(bytes(titles[i]).length > 0, "Title cannot be empty");
            require(bytes(ipTypes[i]).length > 0, "IP type cannot be empty");
            require(bytes(tokenURIs[i]).length > 0, "Token URI cannot be empty");
            require(contentHashes[i] != bytes32(0), "Content hash cannot be empty");
            
            _tokenIdCounter++;
            uint256 tokenId = _tokenIdCounter;
            
            _safeMint(recipients[i], tokenId);
            _setTokenURI(tokenId, tokenURIs[i]);
            
            // Store IP metadata with empty tags array for batch efficiency
            string[] memory emptyTags = new string[](0);
            ipMetadata[tokenId] = IPMetadata({
                title: titles[i],
                description: descriptions[i],
                ipType: ipTypes[i],
                creator: msg.sender,
                createdAt: block.timestamp,
                tags: emptyTags,
                contentHash: contentHashes[i],
                isActive: true,
                metadataBytes: "",
                schemaVersion: "1.0.0",
                externalUrl: "",
                imageUrl: ""
            });
            
            creatorTokens[msg.sender].push(tokenId);
            tokenIds[i] = tokenId;
            
            emit IPNFTMinted(tokenId, msg.sender, recipients[i], titles[i], ipTypes[i], tokenURIs[i]);
        }
        
        return tokenIds;
    }
}