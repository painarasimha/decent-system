// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./PatientRegistry.sol";
import "./DoctorRegistry.sol";

/**
 * @title RecordRegistry
 * @dev Stores minimal metadata for health records (IPFS CIDs only)
 * CRITICAL: Never store actual health data on-chain!
 */
contract RecordRegistry {
    
    enum RecordType { General, LabResult, Imaging, Prescription, Diagnosis, Other }
    
    struct Record {
        uint256 recordId;
        address owner;              // Patient wallet
        string dataCID;             // IPFS CID of encrypted health data
        string encryptedKeyCID;     // IPFS CID of encrypted symmetric key (for owner)
        RecordType recordType;
        bytes32 recordHash;         // Hash of plaintext for integrity verification
        string shortDescription;    // Brief non-sensitive description (max 100 chars)
        address addedBy;            // Who added (patient or authorized doctor)
        uint256 createdAt;
        bool isActive;              // For soft deletion
    }
    
    // State
    uint256 private recordCounter;
    mapping(uint256 => Record) public records;
    mapping(address => uint256[]) private patientRecords; // patient => recordIds
    
    // Contract references
    PatientRegistry public patientRegistry;
    DoctorRegistry public doctorRegistry;
    
    // Events
    event RecordAdded(
        uint256 indexed recordId,
        address indexed owner,
        string dataCID,
        RecordType recordType,
        address indexed addedBy,
        uint256 timestamp
    );
    event RecordDeactivated(uint256 indexed recordId, uint256 timestamp);
    
    // Modifiers
    modifier onlyPatient() {
        require(patientRegistry.isPatient(msg.sender), "Only registered patients");
        _;
    }
    
    modifier onlyVerifiedDoctor() {
        require(doctorRegistry.isVerifiedDoctor(msg.sender), "Only verified doctors");
        _;
    }
    
    constructor(address _patientRegistry, address _doctorRegistry) {
        patientRegistry = PatientRegistry(_patientRegistry);
        doctorRegistry = DoctorRegistry(_doctorRegistry);
        recordCounter = 0;
    }
    
    /**
     * @dev Add a new health record
     * @param _owner Patient who owns the record
     * @param _dataCID IPFS CID of encrypted health data
     * @param _encryptedKeyCID IPFS CID of encrypted symmetric key
     * @param _recordType Type of record
     * @param _recordHash SHA256 hash of plaintext data (for integrity)
     * @param _shortDescription Brief description (non-sensitive)
     */
    function addRecord(
        address _owner,
        string memory _dataCID,
        string memory _encryptedKeyCID,
        RecordType _recordType,
        bytes32 _recordHash,
        string memory _shortDescription
    ) external returns (uint256) {
        require(patientRegistry.isPatient(_owner), "Owner must be registered patient");
        require(bytes(_dataCID).length > 0, "Data CID required");
        require(bytes(_encryptedKeyCID).length > 0, "Encrypted key CID required");
        require(bytes(_shortDescription).length <= 100, "Description too long");
        
        // Only patient themselves or verified doctor can add
        require(
            msg.sender == _owner || doctorRegistry.isVerifiedDoctor(msg.sender),
            "Unauthorized: only patient or verified doctor"
        );
        
        recordCounter++;
        uint256 newRecordId = recordCounter;
        
        records[newRecordId] = Record({
            recordId: newRecordId,
            owner: _owner,
            dataCID: _dataCID,
            encryptedKeyCID: _encryptedKeyCID,
            recordType: _recordType,
            recordHash: _recordHash,
            shortDescription: _shortDescription,
            addedBy: msg.sender,
            createdAt: block.timestamp,
            isActive: true
        });
        
        patientRecords[_owner].push(newRecordId);
        
        emit RecordAdded(
            newRecordId,
            _owner,
            _dataCID,
            _recordType,
            msg.sender,
            block.timestamp
        );
        
        return newRecordId;
    }
    
    /**
     * @dev Soft delete a record (only owner can deactivate)
     * @param _recordId Record ID to deactivate
     */
    function deactivateRecord(uint256 _recordId) external {
        require(records[_recordId].owner == msg.sender, "Only owner can deactivate");
        require(records[_recordId].isActive, "Record already inactive");
        
        records[_recordId].isActive = false;
        
        emit RecordDeactivated(_recordId, block.timestamp);
    }
    
    /**
     * @dev Get record details
     * @param _recordId Record ID
     */
    function getRecord(uint256 _recordId) external view returns (Record memory) {
        require(records[_recordId].recordId != 0, "Record does not exist");
        return records[_recordId];
    }
    
    /**
     * @dev Get all record IDs for a patient
     * @param _patient Patient address
     */
    function getPatientRecordIds(address _patient) external view returns (uint256[] memory) {
        require(patientRegistry.isPatient(_patient), "Not a registered patient");
        return patientRecords[_patient];
    }
    
    /**
     * @dev Get active record IDs for a patient
     * @param _patient Patient address
     */
    function getActivePatientRecordIds(address _patient) external view returns (uint256[] memory) {
        require(patientRegistry.isPatient(_patient), "Not a registered patient");
        
        uint256[] memory allRecords = patientRecords[_patient];
        uint256 activeCount = 0;
        
        // Count active records
        for (uint256 i = 0; i < allRecords.length; i++) {
            if (records[allRecords[i]].isActive) {
                activeCount++;
            }
        }
        
        // Build active records array
        uint256[] memory activeRecords = new uint256[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allRecords.length; i++) {
            if (records[allRecords[i]].isActive) {
                activeRecords[index] = allRecords[i];
                index++;
            }
        }
        
        return activeRecords;
    }
    
    /**
     * @dev Get total number of records
     */
    function getTotalRecords() external view returns (uint256) {
        return recordCounter;
    }
}