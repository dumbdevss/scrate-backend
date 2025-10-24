// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title IPNFTMarketplace
 * @dev Marketplace contract for trading IP-NFTs with auction and direct sale functionality
 */
contract IPNFTMarketplace is ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;
    
    Counters.Counter private _listingIds;
    Counters.Counter private _auctionIds;
    
    // Platform fee (in basis points, e.g., 250 = 2.5%)
    uint256 public platformFee = 250;
    uint256 public constant MAX_PLATFORM_FEE = 1000; // 10% max
    
    struct Listing {
        uint256 listingId;
        address tokenContract;
        uint256 tokenId;
        address seller;
        uint256 price;
        bool active;
        uint256 createdAt;
    }
    
    struct Auction {
        uint256 auctionId;
        address tokenContract;
        uint256 tokenId;
        address seller;
        uint256 startingPrice;
        uint256 currentBid;
        address currentBidder;
        uint256 endTime;
        bool active;
        uint256 createdAt;
    }
    
    // Mapping from listing ID to listing details
    mapping(uint256 => Listing) public listings;
    
    // Mapping from auction ID to auction details
    mapping(uint256 => Auction) public auctions;
    
    // Mapping from token contract + token ID to listing ID
    mapping(address => mapping(uint256 => uint256)) public tokenToListing;
    
    // Mapping from token contract + token ID to auction ID
    mapping(address => mapping(uint256 => uint256)) public tokenToAuction;
    
    // Events
    event ItemListed(
        uint256 indexed listingId,
        address indexed tokenContract,
        uint256 indexed tokenId,
        address seller,
        uint256 price
    );
    
    event ItemSold(
        uint256 indexed listingId,
        address indexed tokenContract,
        uint256 indexed tokenId,
        address seller,
        address buyer,
        uint256 price
    );
    
    event ListingCancelled(
        uint256 indexed listingId,
        address indexed tokenContract,
        uint256 indexed tokenId
    );
    
    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed tokenContract,
        uint256 indexed tokenId,
        address seller,
        uint256 startingPrice,
        uint256 endTime
    );
    
    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 bidAmount
    );
    
    event AuctionEnded(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 winningBid
    );
    
    event AuctionCancelled(
        uint256 indexed auctionId,
        address indexed tokenContract,
        uint256 indexed tokenId
    );
    
    modifier onlyTokenOwner(address tokenContract, uint256 tokenId) {
        require(
            IERC721(tokenContract).ownerOf(tokenId) == msg.sender,
            "Not token owner"
        );
        _;
    }
    
    modifier validListing(uint256 listingId) {
        require(listings[listingId].active, "Listing not active");
        _;
    }
    
    modifier validAuction(uint256 auctionId) {
        require(auctions[auctionId].active, "Auction not active");
        require(block.timestamp < auctions[auctionId].endTime, "Auction ended");
        _;
    }
    
    constructor() {}
    
    /**
     * @dev List an IP-NFT for direct sale
     */
    function listItem(
        address tokenContract,
        uint256 tokenId,
        uint256 price
    ) external onlyTokenOwner(tokenContract, tokenId) nonReentrant {
        require(price > 0, "Price must be greater than 0");
        require(tokenToListing[tokenContract][tokenId] == 0, "Already listed");
        require(tokenToAuction[tokenContract][tokenId] == 0, "Already in auction");
        
        // Transfer token to marketplace
        IERC721(tokenContract).transferFrom(msg.sender, address(this), tokenId);
        
        _listingIds.increment();
        uint256 listingId = _listingIds.current();
        
        listings[listingId] = Listing({
            listingId: listingId,
            tokenContract: tokenContract,
            tokenId: tokenId,
            seller: msg.sender,
            price: price,
            active: true,
            createdAt: block.timestamp
        });
        
        tokenToListing[tokenContract][tokenId] = listingId;
        
        emit ItemListed(listingId, tokenContract, tokenId, msg.sender, price);
    }
    
    /**
     * @dev Buy a listed IP-NFT
     */
    function buyItem(uint256 listingId) 
        external 
        payable 
        validListing(listingId) 
        nonReentrant 
    {
        Listing storage listing = listings[listingId];
        require(msg.value >= listing.price, "Insufficient payment");
        require(msg.sender != listing.seller, "Cannot buy own item");
        
        listing.active = false;
        tokenToListing[listing.tokenContract][listing.tokenId] = 0;
        
        // Calculate platform fee
        uint256 fee = (listing.price * platformFee) / 10000;
        uint256 sellerAmount = listing.price - fee;
        
        // Transfer token to buyer
        IERC721(listing.tokenContract).transferFrom(
            address(this),
            msg.sender,
            listing.tokenId
        );
        
        // Transfer payments
        payable(listing.seller).transfer(sellerAmount);
        if (fee > 0) {
            payable(owner()).transfer(fee);
        }
        
        // Refund excess payment
        if (msg.value > listing.price) {
            payable(msg.sender).transfer(msg.value - listing.price);
        }
        
        emit ItemSold(
            listingId,
            listing.tokenContract,
            listing.tokenId,
            listing.seller,
            msg.sender,
            listing.price
        );
    }
    
    /**
     * @dev Cancel a listing
     */
    function cancelListing(uint256 listingId) 
        external 
        validListing(listingId) 
        nonReentrant 
    {
        Listing storage listing = listings[listingId];
        require(msg.sender == listing.seller, "Not seller");
        
        listing.active = false;
        tokenToListing[listing.tokenContract][listing.tokenId] = 0;
        
        // Return token to seller
        IERC721(listing.tokenContract).transferFrom(
            address(this),
            listing.seller,
            listing.tokenId
        );
        
        emit ListingCancelled(listingId, listing.tokenContract, listing.tokenId);
    }
    
    /**
     * @dev Create an auction for an IP-NFT
     */
    function createAuction(
        address tokenContract,
        uint256 tokenId,
        uint256 startingPrice,
        uint256 duration
    ) external onlyTokenOwner(tokenContract, tokenId) nonReentrant {
        require(startingPrice > 0, "Starting price must be greater than 0");
        require(duration >= 1 hours, "Duration must be at least 1 hour");
        require(duration <= 30 days, "Duration cannot exceed 30 days");
        require(tokenToListing[tokenContract][tokenId] == 0, "Already listed");
        require(tokenToAuction[tokenContract][tokenId] == 0, "Already in auction");
        
        // Transfer token to marketplace
        IERC721(tokenContract).transferFrom(msg.sender, address(this), tokenId);
        
        _auctionIds.increment();
        uint256 auctionId = _auctionIds.current();
        
        auctions[auctionId] = Auction({
            auctionId: auctionId,
            tokenContract: tokenContract,
            tokenId: tokenId,
            seller: msg.sender,
            startingPrice: startingPrice,
            currentBid: 0,
            currentBidder: address(0),
            endTime: block.timestamp + duration,
            active: true,
            createdAt: block.timestamp
        });
        
        tokenToAuction[tokenContract][tokenId] = auctionId;
        
        emit AuctionCreated(
            auctionId,
            tokenContract,
            tokenId,
            msg.sender,
            startingPrice,
            block.timestamp + duration
        );
    }
    
    /**
     * @dev Place a bid on an auction
     */
    function placeBid(uint256 auctionId) 
        external 
        payable 
        validAuction(auctionId) 
        nonReentrant 
    {
        Auction storage auction = auctions[auctionId];
        require(msg.sender != auction.seller, "Cannot bid on own auction");
        
        uint256 minBid = auction.currentBid == 0 
            ? auction.startingPrice 
            : auction.currentBid + ((auction.currentBid * 5) / 100); // 5% minimum increment
            
        require(msg.value >= minBid, "Bid too low");
        
        // Refund previous bidder
        if (auction.currentBidder != address(0)) {
            payable(auction.currentBidder).transfer(auction.currentBid);
        }
        
        auction.currentBid = msg.value;
        auction.currentBidder = msg.sender;
        
        // Extend auction if bid placed in last 10 minutes
        if (auction.endTime - block.timestamp < 10 minutes) {
            auction.endTime = block.timestamp + 10 minutes;
        }
        
        emit BidPlaced(auctionId, msg.sender, msg.value);
    }
    
    /**
     * @dev End an auction and transfer the NFT to the winner
     */
    function endAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(auction.active, "Auction not active");
        require(block.timestamp >= auction.endTime, "Auction not ended");
        
        auction.active = false;
        tokenToAuction[auction.tokenContract][auction.tokenId] = 0;
        
        if (auction.currentBidder != address(0)) {
            // Calculate platform fee
            uint256 fee = (auction.currentBid * platformFee) / 10000;
            uint256 sellerAmount = auction.currentBid - fee;
            
            // Transfer token to winner
            IERC721(auction.tokenContract).transferFrom(
                address(this),
                auction.currentBidder,
                auction.tokenId
            );
            
            // Transfer payments
            payable(auction.seller).transfer(sellerAmount);
            if (fee > 0) {
                payable(owner()).transfer(fee);
            }
            
            emit AuctionEnded(auctionId, auction.currentBidder, auction.currentBid);
        } else {
            // No bids, return token to seller
            IERC721(auction.tokenContract).transferFrom(
                address(this),
                auction.seller,
                auction.tokenId
            );
            
            emit AuctionCancelled(auctionId, auction.tokenContract, auction.tokenId);
        }
    }
    
    /**
     * @dev Cancel an auction (only if no bids)
     */
    function cancelAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(auction.active, "Auction not active");
        require(msg.sender == auction.seller, "Not seller");
        require(auction.currentBidder == address(0), "Cannot cancel with bids");
        
        auction.active = false;
        tokenToAuction[auction.tokenContract][auction.tokenId] = 0;
        
        // Return token to seller
        IERC721(auction.tokenContract).transferFrom(
            address(this),
            auction.seller,
            auction.tokenId
        );
        
        emit AuctionCancelled(auctionId, auction.tokenContract, auction.tokenId);
    }
    
    /**
     * @dev Update platform fee (only owner)
     */
    function updatePlatformFee(uint256 newFee) external onlyOwner {
        require(newFee <= MAX_PLATFORM_FEE, "Fee too high");
        platformFee = newFee;
    }
    
    /**
     * @dev Get listing details
     */
    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }
    
    /**
     * @dev Get auction details
     */
    function getAuction(uint256 auctionId) external view returns (Auction memory) {
        return auctions[auctionId];
    }
    
    /**
     * @dev Get total number of listings
     */
    function getTotalListings() external view returns (uint256) {
        return _listingIds.current();
    }
    
    /**
     * @dev Get total number of auctions
     */
    function getTotalAuctions() external view returns (uint256) {
        return _auctionIds.current();
    }
}
