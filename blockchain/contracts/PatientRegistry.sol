// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title PatientRegistry
 * @dev Manages patient profiles on-chain (minimal PII)
 */
contract PatientRegistry {
    
    struct Patient {
        address walletAddress;
        string profileCID;        // IPFS CID pointing to encrypted profile data
        bool isRegistered;
        uint256 registeredAt;
    }
    
    // Mappings
    mapping(address => Patient) public patients;
    
    // Events
    event PatientRegistered(address indexed patient, string profileCID, uint256 timestamp);
    event PatientProfileUpdated(address indexed patient, string newProfileCID, uint256 timestamp);
    
    // Modifiers
    modifier onlyRegisteredPatient() {
        require(patients[msg.sender].isRegistered, "Patient not registered");
        _;
    }
    
    /**
     * @dev Register a new patient
     * @param _profileCID IPFS CID of encrypted profile data
     */
    function registerPatient(string memory _profileCID) external {
        require(!patients[msg.sender].isRegistered, "Patient already registered");
        require(bytes(_profileCID).length > 0, "Profile CID cannot be empty");
        
        patients[msg.sender] = Patient({
            walletAddress: msg.sender,
            profileCID: _profileCID,
            isRegistered: true,
            registeredAt: block.timestamp
        });
        
        emit PatientRegistered(msg.sender, _profileCID, block.timestamp);
    }
    
    /**
     * @dev Update patient profile
     * @param _newProfileCID New IPFS CID
     */
    function updateProfile(string memory _newProfileCID) external onlyRegisteredPatient {
        require(bytes(_newProfileCID).length > 0, "Profile CID cannot be empty");
        
        patients[msg.sender].profileCID = _newProfileCID;
        
        emit PatientProfileUpdated(msg.sender, _newProfileCID, block.timestamp);
    }
    
    /**
     * @dev Check if address is registered patient
     * @param _patient Address to check
     */
    function isPatient(address _patient) external view returns (bool) {
        return patients[_patient].isRegistered;
    }
    
    /**
     * @dev Get patient profile CID
     * @param _patient Patient address
     */
    function getPatientProfile(address _patient) external view returns (string memory) {
        require(patients[_patient].isRegistered, "Patient not registered");
        return patients[_patient].profileCID;
    }
}