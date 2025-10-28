// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./ipNft.sol";

/**
 * @title IPNFTEscrow
 * @dev Escrow contract for Real World Asset (RWA) IP-NFTs with verification system
 * Allows secure transactions with verification requirements from both parties
 */
contract IPNFTEscrow is Ownable, ReentrancyGuard {
    uint256 private _escrowIds;
    
    enum EscrowStatus {
        Active,
        SellerVerified,
        BuyerVerified,
        BothVerified,
        Completed,
        Disputed,
        Cancelled,
        Refunded
    }
    
    enum VerificationType {
        DocumentHash,
        PhysicalInspection,
        ThirdPartyAudit,
        LegalCompliance,
        IPOwnership
    }
    
    struct VerificationRequirement {
        VerificationType verificationType;
        string description;
        bytes32 expectedHash; // For document verification
        bool sellerCompleted;
        bool buyerApproved;
        uint256 deadline;
    }
    
    struct EscrowAgreement {
        uint256 escrowId;
        address tokenAddress;
        uint256 tokenId;
        address seller;
        address buyer;
        uint256 price;
        uint256 escrowFee;
        EscrowStatus status;
        uint256 createdAt;
        uint256 completionDeadline;
    }
    
    // Mapping from escrow ID to escrow agreement
    mapping(uint256 => EscrowAgreement) public escrows;
    
    // Mapping from token to active escrow
    mapping(address => mapping(uint256 => uint256)) public tokenToEscrow;
    
    // Authorized verifiers for third-party verification
    mapping(address => bool) public authorizedVerifiers;
    
    // Separate mappings for data that was in struct
    mapping(uint256 => VerificationRequirement[]) public escrowVerificationRequirements;
    mapping(uint256 => string[]) public escrowSellerEvidence;
    mapping(uint256 => string[]) public escrowBuyerComments;
    
    // Escrow fee percentage (in basis points)
    uint256 public escrowFeeRate = 100; // 1%
    uint256 public constant MAX_ESCROW_FEE = 500; // 5% max
    
    // Dispute resolution
    address public disputeResolver;
    uint256 public disputeResolutionFee = 50; // 0.5%
    
    // Events
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed tokenAddress,
        uint256 indexed tokenId,
        address seller,
        address buyer,
        uint256 price
    );
    
    event VerificationSubmitted(
        uint256 indexed escrowId,
        address indexed submitter,
        uint256 requirementIndex,
        string evidence
    );
    
    event VerificationApproved(
        uint256 indexed escrowId,
        address indexed approver,
        uint256 requirementIndex
    );
    
    event EscrowCompleted(
        uint256 indexed escrowId,
        address indexed buyer,
        address indexed seller
    );
    
    event DisputeRaised(
        uint256 indexed escrowId,
        address indexed initiator,
        string reason
    );
    
    event DisputeResolved(
        uint256 indexed escrowId,
        address indexed winner,
        string resolution
    );
    
    event EscrowCancelled(uint256 indexed escrowId, string reason);
    
    modifier onlyEscrowParties(uint256 escrowId) {
        require(
            msg.sender == escrows[escrowId].seller || 
            msg.sender == escrows[escrowId].buyer,
            "Not authorized"
        );
        _;
    }
    
    modifier onlyDisputeResolver() {
        require(msg.sender == disputeResolver, "Not dispute resolver");
        _;
    }
    
    modifier validEscrow(uint256 escrowId) {
        require(escrows[escrowId].seller != address(0), "Escrow does not exist");
        require(
            escrows[escrowId].status == EscrowStatus.Active ||
            escrows[escrowId].status == EscrowStatus.SellerVerified ||
            escrows[escrowId].status == EscrowStatus.BuyerVerified ||
            escrows[escrowId].status == EscrowStatus.BothVerified,
            "Escrow not active"
        );
        _;
    }

    constructor(address _disputeResolver) Ownable(msg.sender) {
        disputeResolver = _disputeResolver;
    }
    
    /**
     * @dev Create an escrow agreement for RWA IP-NFT
     */
    function createEscrow(
        address tokenAddress,
        uint256 tokenId,
        address seller,
        uint256 completionDays,
        VerificationType[] calldata verificationTypes,
        string[] calldata verificationDescriptions,
        bytes32[] calldata expectedHashes,
        uint256[] calldata verificationDeadlines
    ) external payable nonReentrant {
        require(IPNFT(tokenAddress).ownerOf(tokenId) == seller, "Seller not token owner");
        require(IPNFT(tokenAddress).isMarketplaceApproved(address(this), tokenId), "Escrow not approved");
        require(msg.sender != address(0) && msg.sender != seller, "Invalid buyer");
        require(msg.value > 0, "Price must be greater than 0");
        require(tokenToEscrow[tokenAddress][tokenId] == 0, "Token already in escrow");
        require(verificationTypes.length == verificationDescriptions.length, "Mismatched arrays");
        require(verificationTypes.length == expectedHashes.length, "Mismatched arrays");
        require(verificationTypes.length == verificationDeadlines.length, "Mismatched arrays");
        require(completionDays >= 1 && completionDays <= 90, "Invalid completion period");
        
        uint256 escrowFee = (msg.value * escrowFeeRate) / 10000;
        uint256 price = msg.value - escrowFee;
        
        // Transfer NFT to escrow
        require(IPNFT(tokenAddress).transferNFT(seller, address(this), tokenId), "Transfer failed");
        
        _escrowIds++;
        uint256 escrowId = _escrowIds;
        
        EscrowAgreement storage escrow = escrows[escrowId];
        escrow.escrowId = escrowId;
        escrow.tokenAddress = tokenAddress;
        escrow.tokenId = tokenId;
        escrow.seller = seller;
        escrow.buyer = msg.sender;
        escrow.price = price;
        escrow.escrowFee = escrowFee;
        escrow.status = EscrowStatus.Active;
        escrow.createdAt = block.timestamp;
        escrow.completionDeadline = block.timestamp + (completionDays * 1 days);
        
        // Add verification requirements
        for (uint256 i = 0; i < verificationTypes.length; i++) {
            escrowVerificationRequirements[escrowId].push(VerificationRequirement({
                verificationType: verificationTypes[i],
                description: verificationDescriptions[i],
                expectedHash: expectedHashes[i],
                sellerCompleted: false,
                buyerApproved: false,
                deadline: block.timestamp + (verificationDeadlines[i] * 1 days)
            }));
        }
        
        tokenToEscrow[tokenAddress][tokenId] = escrowId;
        
        emit EscrowCreated(escrowId, tokenAddress, tokenId, seller, msg.sender, price);
    }
    
    /**
     * @dev Seller submits verification evidence
     */
    function submitVerification(
        uint256 escrowId,
        uint256 requirementIndex,
        string calldata evidence,
        bytes32 documentHash
    ) external validEscrow(escrowId) {
        EscrowAgreement storage escrow = escrows[escrowId];
        require(msg.sender == escrow.seller, "Only seller can submit");
        require(requirementIndex < escrowVerificationRequirements[escrowId].length, "Invalid requirement");
        require(block.timestamp <= escrowVerificationRequirements[escrowId][requirementIndex].deadline, "Deadline passed");
        
        VerificationRequirement storage requirement = escrowVerificationRequirements[escrowId][requirementIndex];
        require(!requirement.sellerCompleted, "Already submitted");
        
        // Verify document hash if required
        if (requirement.verificationType == VerificationType.DocumentHash) {
            require(documentHash == requirement.expectedHash, "Document hash mismatch");
        }
        
        requirement.sellerCompleted = true;
        escrowSellerEvidence[escrowId].push(evidence);
        
        emit VerificationSubmitted(escrowId, msg.sender, requirementIndex, evidence);
        
        _updateEscrowStatus(escrowId);
    }
    
    /**
     * @dev Buyer approves verification evidence
     */
    function approveVerification(
        uint256 escrowId,
        uint256 requirementIndex,
        string calldata comment
    ) external validEscrow(escrowId) {
        EscrowAgreement storage escrow = escrows[escrowId];
        require(msg.sender == escrow.buyer, "Only buyer can approve");
        require(requirementIndex < escrowVerificationRequirements[escrowId].length, "Invalid requirement");
        
        VerificationRequirement storage requirement = escrowVerificationRequirements[escrowId][requirementIndex];
        require(requirement.sellerCompleted, "Seller hasn't submitted yet");
        require(!requirement.buyerApproved, "Already approved");
        
        requirement.buyerApproved = true;
        if (bytes(comment).length > 0) {
            escrowBuyerComments[escrowId].push(comment);
        }
        
        emit VerificationApproved(escrowId, msg.sender, requirementIndex);
        
        _updateEscrowStatus(escrowId);
    }
    
    /**
     * @dev Complete escrow and transfer assets
     */
    function completeEscrow(uint256 escrowId) external validEscrow(escrowId) nonReentrant {
        EscrowAgreement storage escrow = escrows[escrowId];
        require(
            escrow.status == EscrowStatus.BothVerified,
            "Verification not complete"
        );
        require(
            msg.sender == escrow.buyer || msg.sender == escrow.seller,
            "Not authorized"
        );
        require(block.timestamp <= escrow.completionDeadline, "Completion deadline passed");
        
        escrow.status = EscrowStatus.Completed;
        tokenToEscrow[escrow.tokenAddress][escrow.tokenId] = 0;
        
        // Transfer NFT to buyer
        require(IPNFT(escrow.tokenAddress).transferNFT(address(this), escrow.buyer, escrow.tokenId), "Transfer failed");
        
        // Transfer payment to seller
        payable(escrow.seller).transfer(escrow.price);
        
        // Transfer escrow fee to owner
        if (escrow.escrowFee > 0) {
            payable(owner()).transfer(escrow.escrowFee);
        }
        
        emit EscrowCompleted(escrowId, escrow.buyer, escrow.seller);
    }
    
    /**
     * @dev Raise a dispute
     */
    function raiseDispute(uint256 escrowId, string calldata reason) 
        external 
        validEscrow(escrowId) 
        onlyEscrowParties(escrowId) 
    {
        EscrowAgreement storage escrow = escrows[escrowId];
        escrow.status = EscrowStatus.Disputed;
        
        emit DisputeRaised(escrowId, msg.sender, reason);
    }
    
    /**
     * @dev Resolve dispute (only dispute resolver)
     */
    function resolveDispute(
        uint256 escrowId,
        address winner,
        string calldata resolution
    ) external onlyDisputeResolver nonReentrant {
        EscrowAgreement storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.Disputed, "Not in dispute");
        require(winner == escrow.buyer || winner == escrow.seller, "Invalid winner");
        
        uint256 disputeFee = (escrow.price * disputeResolutionFee) / 10000;
        uint256 payoutAmount = escrow.price - disputeFee;
        
        tokenToEscrow[escrow.tokenAddress][escrow.tokenId] = 0;
        
        if (winner == escrow.buyer) {
            // Buyer wins - gets NFT and refund
            require(IPNFT(escrow.tokenAddress).transferNFT(address(this), escrow.buyer, escrow.tokenId), "Transfer failed");
            payable(escrow.buyer).transfer(payoutAmount);
            escrow.status = EscrowStatus.Refunded;
        } else {
            // Seller wins - gets payment, NFT returned
            require(IPNFT(escrow.tokenAddress).transferNFT(address(this), escrow.seller, escrow.tokenId), "Transfer failed");
            payable(escrow.seller).transfer(payoutAmount);
            escrow.status = EscrowStatus.Completed;
        }
        
        // Pay dispute resolution fee
        payable(disputeResolver).transfer(disputeFee);
        payable(owner()).transfer(escrow.escrowFee);
        
        emit DisputeResolved(escrowId, winner, resolution);
    }
    
    /**
     * @dev Cancel escrow (only if no verifications completed)
     */
    function cancelEscrow(uint256 escrowId, string calldata reason) 
        external 
        validEscrow(escrowId) 
        onlyEscrowParties(escrowId) 
        nonReentrant 
    {
        EscrowAgreement storage escrow = escrows[escrowId];
        
        // Check if any verifications are completed
        bool hasCompletedVerifications = false;
        for (uint256 i = 0; i < escrowVerificationRequirements[escrowId].length; i++) {
            if (escrowVerificationRequirements[escrowId][i].sellerCompleted) {
                hasCompletedVerifications = true;
                break;
            }
        }
        
        require(!hasCompletedVerifications, "Cannot cancel with completed verifications");
        
        escrow.status = EscrowStatus.Cancelled;
        tokenToEscrow[escrow.tokenAddress][escrow.tokenId] = 0;
        
        // Return NFT to seller
        require(IPNFT(escrow.tokenAddress).transferNFT(address(this), escrow.seller, escrow.tokenId), "Transfer failed");
        
        // Refund buyer (minus escrow fee for processing)
        uint256 refundAmount = escrow.price;
        payable(escrow.buyer).transfer(refundAmount);
        payable(owner()).transfer(escrow.escrowFee);
        
        emit EscrowCancelled(escrowId, reason);
    }
    
    /**
     * @dev Internal function to update escrow status based on verifications
     */
    function _updateEscrowStatus(uint256 escrowId) internal {
        EscrowAgreement storage escrow = escrows[escrowId];
        
        bool allSellerCompleted = true;
        bool allBuyerApproved = true;
        
        for (uint256 i = 0; i < escrowVerificationRequirements[escrowId].length; i++) {
            if (!escrowVerificationRequirements[escrowId][i].sellerCompleted) {
                allSellerCompleted = false;
            }
            if (!escrowVerificationRequirements[escrowId][i].buyerApproved) {
                allBuyerApproved = false;
            }
        }
        
        if (allSellerCompleted && allBuyerApproved) {
            escrow.status = EscrowStatus.BothVerified;
        } else if (allSellerCompleted) {
            escrow.status = EscrowStatus.SellerVerified;
        } else if (allBuyerApproved) {
            escrow.status = EscrowStatus.BuyerVerified;
        }
    }
    
    /**
     * @dev Get escrow details
     */
    function getEscrow(uint256 escrowId) external view returns (
        uint256 id,
        address tokenAddress,
        uint256 tokenId,
        address seller,
        address buyer,
        uint256 price,
        uint256 escrowFee,
        EscrowStatus status,
        uint256 createdAt,
        uint256 completionDeadline
    ) {
        EscrowAgreement storage escrow = escrows[escrowId];
        return (
            escrow.escrowId,
            escrow.tokenAddress,
            escrow.tokenId,
            escrow.seller,
            escrow.buyer,
            escrow.price,
            escrow.escrowFee,
            escrow.status,
            escrow.createdAt,
            escrow.completionDeadline
        );
    }
    
    /**
     * @dev Get verification requirements for an escrow
     */
    function getVerificationRequirements(uint256 escrowId) 
        external 
        view 
        returns (VerificationRequirement[] memory) 
    {
        return escrowVerificationRequirements[escrowId];
    }
    
    /**
     * @dev Get seller evidence
     */
    function getSellerEvidence(uint256 escrowId) 
        external 
        view 
        returns (string[] memory) 
    {
        return escrowSellerEvidence[escrowId];
    }
    
    /**
     * @dev Get buyer comments
     */
    function getBuyerComments(uint256 escrowId) 
        external 
        view 
        returns (string[] memory) 
    {
        return escrowBuyerComments[escrowId];
    }
    
    /**
     * @dev Update escrow fee rate (only owner)
     */
    function updateEscrowFeeRate(uint256 newRate) external onlyOwner {
        require(newRate <= MAX_ESCROW_FEE, "Fee too high");
        escrowFeeRate = newRate;
    }
    
    /**
     * @dev Update dispute resolver (only owner)
     */
    function updateDisputeResolver(address newResolver) external onlyOwner {
        require(newResolver != address(0), "Invalid resolver");
        disputeResolver = newResolver;
    }
    
    /**
     * @dev Authorize verifier (only owner)
     */
    function authorizeVerifier(address verifier) external onlyOwner {
        authorizedVerifiers[verifier] = true;
    }
    
    /**
     * @dev Revoke verifier authorization (only owner)
     */
    function revokeVerifier(address verifier) external onlyOwner {
        authorizedVerifiers[verifier] = false;
    }
    
    /**
     * @dev Get total number of escrows
     */
    function getTotalEscrows() external view returns (uint256) {
        return _escrowIds;
    }
    
}