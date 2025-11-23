// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./RecordRegistry.sol";
import "./DoctorRegistry.sol";

/**
 * @title AccessControl
 * @dev Manages time-limited access grants for health records
 */
contract AccessControl {
    
    enum AccessStatus { None, Requested, Granted, Revoked, Expired }
    
    struct AccessGrant {
        uint256 recordId;
        address patient;
        address doctor;
        string encryptedKeyCID;     // IPFS CID of key encrypted for doctor
        uint256 grantedAt;
        uint256 expiresAt;          // Unix timestamp
        AccessStatus status;
        string requestReason;       // Why doctor needs access
    }
    
    // State
    uint256 private accessCounter;
    mapping(uint256 => AccessGrant) public accessGrants;
    
    // recordId => doctor => accessId
    mapping(uint256 => mapping(address => uint256)) public recordDoctorAccess;
    
    // doctor => recordIds they have access to
    mapping(address => uint256[]) private doctorAccessibleRecords;
    
    // patient => pending access requests
    mapping(address => uint256[]) private patientPendingRequests;
    
    // Contract references
    RecordRegistry public recordRegistry;
    DoctorRegistry public doctorRegistry;
    
    // Events
    event AccessRequested(
        uint256 indexed accessId,
        uint256 indexed recordId,
        address indexed doctor,
        address patient,
        string reason,
        uint256 timestamp
    );
    
    event AccessGranted(
        uint256 indexed accessId,
        uint256 indexed recordId,
        address indexed doctor,
        address patient,
        string encryptedKeyCID,
        uint256 expiresAt,
        uint256 timestamp
    );
    
    event AccessRevoked(
        uint256 indexed accessId,
        uint256 indexed recordId,
        address indexed doctor,
        uint256 timestamp
    );
    
    event AccessExpired(
        uint256 indexed accessId,
        uint256 indexed recordId,
        address indexed doctor,
        uint256 timestamp
    );
    
    // Modifiers
    modifier onlyVerifiedDoctor() {
        require(doctorRegistry.isVerifiedDoctor(msg.sender), "Only verified doctors");
        _;
    }
    
    modifier onlyRecordOwner(uint256 _recordId) {
        RecordRegistry.Record memory record = recordRegistry.getRecord(_recordId);
        require(record.owner == msg.sender, "Only record owner");
        _;
    }
    
    constructor(address _recordRegistry, address _doctorRegistry) {
        recordRegistry = RecordRegistry(_recordRegistry);
        doctorRegistry = DoctorRegistry(_doctorRegistry);
        accessCounter = 0;
    }
    
    /**
     * @dev Doctor requests access to a patient's record
     * @param _recordId Record ID
     * @param _reason Why access is needed
     */
    function requestAccess(
        uint256 _recordId,
        string memory _reason
    ) external onlyVerifiedDoctor returns (uint256) {
        RecordRegistry.Record memory record = recordRegistry.getRecord(_recordId);
        require(record.isActive, "Record is not active");
        require(bytes(_reason).length > 0, "Reason required");
        require(bytes(_reason).length <= 200, "Reason too long");
        
        // Check if already has active access
        uint256 existingAccessId = recordDoctorAccess[_recordId][msg.sender];
        if (existingAccessId != 0) {
            AccessGrant memory existing = accessGrants[existingAccessId];
            require(
                existing.status != AccessStatus.Granted || 
                block.timestamp > existing.expiresAt,
                "Already has active access"
            );
        }
        
        accessCounter++;
        uint256 newAccessId = accessCounter;
        
        accessGrants[newAccessId] = AccessGrant({
            recordId: _recordId,
            patient: record.owner,
            doctor: msg.sender,
            encryptedKeyCID: "",
            grantedAt: 0,
            expiresAt: 0,
            status: AccessStatus.Requested,
            requestReason: _reason
        });
        
        recordDoctorAccess[_recordId][msg.sender] = newAccessId;
        patientPendingRequests[record.owner].push(newAccessId);
        
        emit AccessRequested(
            newAccessId,
            _recordId,
            msg.sender,
            record.owner,
            _reason,
            block.timestamp
        );
        
        return newAccessId;
    }
    
    /**
     * @dev Patient grants access to doctor
     * @param _accessId Access request ID
     * @param _encryptedKeyCID IPFS CID of symmetric key encrypted for doctor
     * @param _durationDays How many days access is valid
     */
    function grantAccess(
        uint256 _accessId,
        string memory _encryptedKeyCID,
        uint256 _durationDays
    ) external {
        require(accessGrants[_accessId].recordId != 0, "Access request does not exist");
        AccessGrant storage access = accessGrants[_accessId];
        
        require(access.patient == msg.sender, "Only patient can grant access");
        require(access.status == AccessStatus.Requested, "Access not in requested state");
        require(bytes(_encryptedKeyCID).length > 0, "Encrypted key CID required");
        require(_durationDays > 0 && _durationDays <= 365, "Invalid duration");
        
        uint256 expiresAt = block.timestamp + (_durationDays * 1 days);
        
        access.encryptedKeyCID = _encryptedKeyCID;
        access.grantedAt = block.timestamp;
        access.expiresAt = expiresAt;
        access.status = AccessStatus.Granted;
        
        doctorAccessibleRecords[access.doctor].push(access.recordId);
        
        emit AccessGranted(
            _accessId,
            access.recordId,
            access.doctor,
            msg.sender,
            _encryptedKeyCID,
            expiresAt,
            block.timestamp
        );
    }
    
    /**
     * @dev Patient revokes access
     * @param _accessId Access ID to revoke
     */
    function revokeAccess(uint256 _accessId) external {
        require(accessGrants[_accessId].recordId != 0, "Access does not exist");
        AccessGrant storage access = accessGrants[_accessId];
        
        require(access.patient == msg.sender, "Only patient can revoke");
        require(access.status == AccessStatus.Granted, "Access not granted");
        require(block.timestamp <= access.expiresAt, "Access already expired");
        
        access.status = AccessStatus.Revoked;
        
        emit AccessRevoked(
            _accessId,
            access.recordId,
            access.doctor,
            block.timestamp
        );
    }
    
    /**
     * @dev Check if doctor has active access to record
     * @param _recordId Record ID
     * @param _doctor Doctor address
     */
    function hasActiveAccess(
        uint256 _recordId,
        address _doctor
    ) external view returns (bool) {
        uint256 accessId = recordDoctorAccess[_recordId][_doctor];
        if (accessId == 0) return false;
        
        AccessGrant memory access = accessGrants[accessId];
        
        return access.status == AccessStatus.Granted && 
               block.timestamp <= access.expiresAt;
    }
    
    /**
     * @dev Get access details
     * @param _accessId Access ID
     */
    function getAccessGrant(uint256 _accessId) external view returns (AccessGrant memory) {
        require(accessGrants[_accessId].recordId != 0, "Access does not exist");
        return accessGrants[_accessId];
    }
    
    /**
     * @dev Get encrypted key CID for doctor (if access is active)
     * @param _recordId Record ID
     */
    function getEncryptedKey(uint256 _recordId) external view returns (string memory) {
        uint256 accessId = recordDoctorAccess[_recordId][msg.sender];
        require(accessId != 0, "No access request found");
        
        AccessGrant memory access = accessGrants[accessId];
        require(access.status == AccessStatus.Granted, "Access not granted");
        require(block.timestamp <= access.expiresAt, "Access expired");
        
        return access.encryptedKeyCID;
    }
    
    /**
     * @dev Get pending access requests for patient
     * @param _patient Patient address
     */
    function getPendingRequests(address _patient) external view returns (uint256[] memory) {
        uint256[] memory allRequests = patientPendingRequests[_patient];
        uint256 pendingCount = 0;
        
        // Count pending
        for (uint256 i = 0; i < allRequests.length; i++) {
            if (accessGrants[allRequests[i]].status == AccessStatus.Requested) {
                pendingCount++;
            }
        }
        
        // Build pending array
        uint256[] memory pending = new uint256[](pendingCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allRequests.length; i++) {
            if (accessGrants[allRequests[i]].status == AccessStatus.Requested) {
                pending[index] = allRequests[i];
                index++;
            }
        }
        
        return pending;
    }
    
    /**
     * @dev Get records accessible by doctor
     * @param _doctor Doctor address
     */
    function getDoctorAccessibleRecords(address _doctor) external view returns (uint256[] memory) {
        uint256[] memory allRecords = doctorAccessibleRecords[_doctor];
        uint256 activeCount = 0;
        
        // Count active access
        for (uint256 i = 0; i < allRecords.length; i++) {
            uint256 accessId = recordDoctorAccess[allRecords[i]][_doctor];
            if (accessId != 0) {
                AccessGrant memory access = accessGrants[accessId];
                if (access.status == AccessStatus.Granted && block.timestamp <= access.expiresAt) {
                    activeCount++;
                }
            }
        }
        
        // Build active records array
        uint256[] memory activeRecords = new uint256[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allRecords.length; i++) {
            uint256 accessId = recordDoctorAccess[allRecords[i]][_doctor];
            if (accessId != 0) {
                AccessGrant memory access = accessGrants[accessId];
                if (access.status == AccessStatus.Granted && block.timestamp <= access.expiresAt) {
                    activeRecords[index] = allRecords[i];
                    index++;
                }
            }
        }
        
        return activeRecords;
    }
}