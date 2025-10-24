// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title IPNFTEscrow
 * @dev Escrow contract for Real World Asset (RWA) IP-NFTs with verification system
 * Allows secure transactions with verification requirements from both parties
 */
contract IPNFTEscrow is ReentrancyGuard, Ownable {
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
        address tokenContract;
        uint256 tokenId;
        address seller;
        address buyer;
        uint256 price;
        uint256 escrowFee;
        EscrowStatus status;
        uint256 createdAt;
        uint256 completionDeadline;
        VerificationRequirement[] verificationRequirements;
        mapping(address => bool) hasVerified;
        string[] sellerEvidence;
        string[] buyerComments;
    }
    
    // Mapping from escrow ID to escrow agreement
    mapping(uint256 => EscrowAgreement) public escrows;
    
    // Mapping from token to active escrow
    mapping(address => mapping(uint256 => uint256)) public tokenToEscrow;
    
    // Authorized verifiers for third-party verification
    mapping(address => bool) public authorizedVerifiers;
    
    // Escrow fee percentage (in basis points)
    uint256 public escrowFeeRate = 100; // 1%
    uint256 public constant MAX_ESCROW_FEE = 500; // 5% max
    
    // Dispute resolution
    address public disputeResolver;
    uint256 public disputeResolutionFee = 50; // 0.5%
    
    // Events
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed tokenContract,
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
    
    constructor(address _disputeResolver) {
        disputeResolver = _disputeResolver;
    }
    
    /**
     * @dev Create an escrow agreement for RWA IP-NFT
     */
    function createEscrow(
        address tokenContract,
        uint256 tokenId,
        address buyer,
        uint256 completionDays,
        VerificationType[] calldata verificationTypes,
        string[] calldata verificationDescriptions,
        bytes32[] calldata expectedHashes,
        uint256[] calldata verificationDeadlines
    ) external payable nonReentrant {
        require(IERC721(tokenContract).ownerOf(tokenId) == msg.sender, "Not token owner");
        require(buyer != address(0) && buyer != msg.sender, "Invalid buyer");
        require(msg.value > 0, "Price must be greater than 0");
        require(tokenToEscrow[tokenContract][tokenId] == 0, "Token already in escrow");
        require(verificationTypes.length == verificationDescriptions.length, "Mismatched arrays");
        require(verificationTypes.length == expectedHashes.length, "Mismatched arrays");
        require(verificationTypes.length == verificationDeadlines.length, "Mismatched arrays");
        require(completionDays >= 1 && completionDays <= 90, "Invalid completion period");
        
        uint256 escrowFee = (msg.value * escrowFeeRate) / 10000;
        uint256 price = msg.value - escrowFee;
        
        // Transfer NFT to escrow
        IERC721(tokenContract).transferFrom(msg.sender, address(this), tokenId);
        
        _escrowIds++;
        uint256 escrowId = _escrowIds;
        
        EscrowAgreement storage escrow = escrows[escrowId];
        escrow.escrowId = escrowId;
        escrow.tokenContract = tokenContract;
        escrow.tokenId = tokenId;
        escrow.seller = msg.sender;
        escrow.buyer = buyer;
        escrow.price = price;
        escrow.escrowFee = escrowFee;
        escrow.status = EscrowStatus.Active;
        escrow.createdAt = block.timestamp;
        escrow.completionDeadline = block.timestamp + (completionDays * 1 days);
        
        // Add verification requirements
        for (uint256 i = 0; i < verificationTypes.length; i++) {
            escrow.verificationRequirements.push(VerificationRequirement({
                verificationType: verificationTypes[i],
                description: verificationDescriptions[i],
                expectedHash: expectedHashes[i],
                sellerCompleted: false,
                buyerApproved: false,
                deadline: block.timestamp + (verificationDeadlines[i] * 1 days)
            }));
        }
        
        tokenToEscrow[tokenContract][tokenId] = escrowId;
        
        emit EscrowCreated(escrowId, tokenContract, tokenId, msg.sender, buyer, price);
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
        require(requirementIndex < escrow.verificationRequirements.length, "Invalid requirement");
        require(block.timestamp <= escrow.verificationRequirements[requirementIndex].deadline, "Deadline passed");
        
        VerificationRequirement storage requirement = escrow.verificationRequirements[requirementIndex];
        require(!requirement.sellerCompleted, "Already submitted");
        
        // Verify document hash if required
        if (requirement.verificationType == VerificationType.DocumentHash) {
            require(documentHash == requirement.expectedHash, "Document hash mismatch");
        }
        
        requirement.sellerCompleted = true;
        escrow.sellerEvidence.push(evidence);
        
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
        require(requirementIndex < escrow.verificationRequirements.length, "Invalid requirement");
        
        VerificationRequirement storage requirement = escrow.verificationRequirements[requirementIndex];
        require(requirement.sellerCompleted, "Seller hasn't submitted yet");
        require(!requirement.buyerApproved, "Already approved");
        
        requirement.buyerApproved = true;
        if (bytes(comment).length > 0) {
            escrow.buyerComments.push(comment);
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
        
        escrow.status = EscrowStatus.Completed;
        tokenToEscrow[escrow.tokenContract][escrow.tokenId] = 0;
        
        // Transfer NFT to buyer
        IERC721(escrow.tokenContract).transferFrom(
            address(this),
            escrow.buyer,
            escrow.tokenId
        );
        
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
        
        tokenToEscrow[escrow.tokenContract][escrow.tokenId] = 0;
        
        if (winner == escrow.buyer) {
            // Buyer wins - gets NFT and refund
            IERC721(escrow.tokenContract).transferFrom(
                address(this),
                escrow.buyer,
                escrow.tokenId
            );
            payable(escrow.buyer).transfer(payoutAmount);
            escrow.status = EscrowStatus.Refunded;
        } else {
            // Seller wins - gets payment, NFT returned
            IERC721(escrow.tokenContract).transferFrom(
                address(this),
                escrow.seller,
                escrow.tokenId
            );
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
        for (uint256 i = 0; i < escrow.verificationRequirements.length; i++) {
            if (escrow.verificationRequirements[i].sellerCompleted) {
                hasCompletedVerifications = true;
                break;
            }
        }
        
        require(!hasCompletedVerifications, "Cannot cancel with completed verifications");
        
        escrow.status = EscrowStatus.Cancelled;
        tokenToEscrow[escrow.tokenContract][escrow.tokenId] = 0;
        
        // Return NFT to seller
        IERC721(escrow.tokenContract).transferFrom(
            address(this),
            escrow.seller,
            escrow.tokenId
        );
        
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
        
        for (uint256 i = 0; i < escrow.verificationRequirements.length; i++) {
            if (!escrow.verificationRequirements[i].sellerCompleted) {
                allSellerCompleted = false;
            }
            if (!escrow.verificationRequirements[i].buyerApproved) {
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
        address tokenContract,
        uint256 tokenId,
        address seller,
        address buyer,
        uint256 price,
        EscrowStatus status,
        uint256 createdAt,
        uint256 completionDeadline
    ) {
        EscrowAgreement storage escrow = escrows[escrowId];
        return (
            escrow.escrowId,
            escrow.tokenContract,
            escrow.tokenId,
            escrow.seller,
            escrow.buyer,
            escrow.price,
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
        return escrows[escrowId].verificationRequirements;
    }
    
    /**
     * @dev Get seller evidence
     */
    function getSellerEvidence(uint256 escrowId) 
        external 
        view 
        returns (string[] memory) 
    {
        return escrows[escrowId].sellerEvidence;
    }
    
    /**
     * @dev Get buyer comments
     */
    function getBuyerComments(uint256 escrowId) 
        external 
        view 
        returns (string[] memory) 
    {
        return escrows[escrowId].buyerComments;
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