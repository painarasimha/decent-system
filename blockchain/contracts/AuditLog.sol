// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AuditLog
 * @dev Lightweight event emitter for audit trails
 * Only emits events, no heavy storage
 */
contract AuditLog {
    
    enum ActionType { 
        RecordViewed, 
        RecordAdded, 
        RecordUpdated, 
        AccessGranted, 
        AccessRevoked,
        AccessRequested,
        ProfileUpdated
    }
    
    // Events (these are automatically indexed by blockchain)
    event AuditEvent(
        uint256 indexed recordId,
        address indexed actor,
        ActionType indexed actionType,
        bytes32 actionHash,        // Hash of action details for integrity
        uint256 timestamp
    );
    
    event DetailedAudit(
        uint256 indexed recordId,
        address indexed actor,
        ActionType actionType,
        string detailsCID,         // IPFS CID with detailed logs (optional)
        uint256 timestamp
    );
    
    /**
     * @dev Log a simple audit event
     * @param _recordId Record ID (use 0 for non-record actions)
     * @param _actor Address performing action
     * @param _actionType Type of action
     * @param _actionHash Hash of action details
     */
    function logEvent(
        uint256 _recordId,
        address _actor,
        ActionType _actionType,
        bytes32 _actionHash
    ) external {
        emit AuditEvent(
            _recordId,
            _actor,
            _actionType,
            _actionHash,
            block.timestamp
        );
    }
    
    /**
     * @dev Log detailed audit with IPFS reference
     * @param _recordId Record ID
     * @param _actor Address performing action
     * @param _actionType Type of action
     * @param _detailsCID IPFS CID with detailed audit log
     */
    function logDetailed(
        uint256 _recordId,
        address _actor,
        ActionType _actionType,
        string memory _detailsCID
    ) external {
        emit DetailedAudit(
            _recordId,
            _actor,
            _actionType,
            _detailsCID,
            block.timestamp
        );
    }
    
    /**
     * @dev Batch log multiple events (gas optimization)
     * @param _recordIds Array of record IDs
     * @param _actors Array of actor addresses
     * @param _actionTypes Array of action types
     * @param _actionHashes Array of action hashes
     */
    function logBatch(
        uint256[] memory _recordIds,
        address[] memory _actors,
        ActionType[] memory _actionTypes,
        bytes32[] memory _actionHashes
    ) external {
        require(
            _recordIds.length == _actors.length &&
            _actors.length == _actionTypes.length &&
            _actionTypes.length == _actionHashes.length,
            "Array length mismatch"
        );
        
        for (uint256 i = 0; i < _recordIds.length; i++) {
            emit AuditEvent(
                _recordIds[i],
                _actors[i],
                _actionTypes[i],
                _actionHashes[i],
                block.timestamp
            );
        }
    }
}