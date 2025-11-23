// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title DoctorRegistry
 * @dev Manages doctor profiles and verification status
 */
contract DoctorRegistry {
    
    enum VerificationStatus { Pending, Verified, Rejected, Suspended }
    
    struct Doctor {
        address walletAddress;
        string profileCID;           // IPFS CID with credentials (encrypted)
        string licenseNumber;        // Medical license (hashed for privacy)
        VerificationStatus status;
        bool isRegistered;
        uint256 registeredAt;
        uint256 verifiedAt;
    }
    
    // Mappings
    mapping(address => Doctor) public doctors;
    
    // Admin address for verification (in production, use multi-sig or DAO)
    address public admin;
    
    // Events
    event DoctorRegistered(address indexed doctor, string profileCID, uint256 timestamp);
    event DoctorVerified(address indexed doctor, uint256 timestamp);
    event DoctorRejected(address indexed doctor, string reason, uint256 timestamp);
    event DoctorSuspended(address indexed doctor, string reason, uint256 timestamp);
    event DoctorProfileUpdated(address indexed doctor, string newProfileCID, uint256 timestamp);
    
    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }
    
    modifier onlyRegisteredDoctor() {
        require(doctors[msg.sender].isRegistered, "Doctor not registered");
        _;
    }
    
    modifier onlyVerifiedDoctor() {
        require(
            doctors[msg.sender].isRegistered && 
            doctors[msg.sender].status == VerificationStatus.Verified,
            "Doctor not verified"
        );
        _;
    }
    
    constructor() {
        admin = msg.sender;
    }
    
    /**
     * @dev Register as a doctor (pending verification)
     * @param _profileCID IPFS CID of encrypted credentials
     * @param _licenseNumber Medical license number (hashed)
     */
    function registerDoctor(
        string memory _profileCID,
        string memory _licenseNumber
    ) external {
        require(!doctors[msg.sender].isRegistered, "Doctor already registered");
        require(bytes(_profileCID).length > 0, "Profile CID cannot be empty");
        require(bytes(_licenseNumber).length > 0, "License number required");
        
        doctors[msg.sender] = Doctor({
            walletAddress: msg.sender,
            profileCID: _profileCID,
            licenseNumber: _licenseNumber,
            status: VerificationStatus.Pending,
            isRegistered: true,
            registeredAt: block.timestamp,
            verifiedAt: 0
        });
        
        emit DoctorRegistered(msg.sender, _profileCID, block.timestamp);
    }
    
    /**
     * @dev Admin verifies a doctor
     * @param _doctor Doctor address to verify
     */
    function verifyDoctor(address _doctor) external onlyAdmin {
        require(doctors[_doctor].isRegistered, "Doctor not registered");
        require(doctors[_doctor].status == VerificationStatus.Pending, "Doctor not pending");
        
        doctors[_doctor].status = VerificationStatus.Verified;
        doctors[_doctor].verifiedAt = block.timestamp;
        
        emit DoctorVerified(_doctor, block.timestamp);
    }
    
    /**
     * @dev Admin rejects a doctor
     * @param _doctor Doctor address to reject
     * @param _reason Rejection reason
     */
    function rejectDoctor(address _doctor, string memory _reason) external onlyAdmin {
        require(doctors[_doctor].isRegistered, "Doctor not registered");
        
        doctors[_doctor].status = VerificationStatus.Rejected;
        
        emit DoctorRejected(_doctor, _reason, block.timestamp);
    }
    
    /**
     * @dev Admin suspends a doctor
     * @param _doctor Doctor address to suspend
     * @param _reason Suspension reason
     */
    function suspendDoctor(address _doctor, string memory _reason) external onlyAdmin {
        require(doctors[_doctor].isRegistered, "Doctor not registered");
        
        doctors[_doctor].status = VerificationStatus.Suspended;
        
        emit DoctorSuspended(_doctor, _reason, block.timestamp);
    }
    
    /**
     * @dev Update doctor profile
     * @param _newProfileCID New IPFS CID
     */
    function updateProfile(string memory _newProfileCID) external onlyRegisteredDoctor {
        require(bytes(_newProfileCID).length > 0, "Profile CID cannot be empty");
        
        doctors[msg.sender].profileCID = _newProfileCID;
        
        emit DoctorProfileUpdated(msg.sender, _newProfileCID, block.timestamp);
    }
    
    /**
     * @dev Check if address is verified doctor
     * @param _doctor Address to check
     */
    function isVerifiedDoctor(address _doctor) external view returns (bool) {
        return doctors[_doctor].isRegistered && 
               doctors[_doctor].status == VerificationStatus.Verified;
    }
    
    /**
     * @dev Get doctor info
     * @param _doctor Doctor address
     */
    function getDoctorInfo(address _doctor) external view returns (
        string memory profileCID,
        VerificationStatus status,
        uint256 registeredAt,
        uint256 verifiedAt
    ) {
        require(doctors[_doctor].isRegistered, "Doctor not registered");
        Doctor memory doc = doctors[_doctor];
        return (doc.profileCID, doc.status, doc.registeredAt, doc.verifiedAt);
    }
    
    /**
     * @dev Transfer admin role (use multi-sig in production)
     * @param _newAdmin New admin address
     */
    function transferAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid admin address");
        admin = _newAdmin;
    }
}