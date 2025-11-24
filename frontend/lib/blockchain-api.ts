import { ethers } from 'ethers';
import PatientRegistryABI from './contracts/PatientRegistry.json';
import DoctorRegistryABI from './contracts/DoctorRegistry.json';
import RecordRegistryABI from './contracts/RecordRegistry.json';
import AccessControlABI from './contracts/AccessControl.json';
import AuditLogABI from './contracts/AuditLog.json';
import deployments from './contracts/deployments.json';

// Get provider (MetaMask or fallback)
const getProvider = () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    // Handle multiple providers (Brave Wallet + MetaMask)
    if (window.ethereum.providers?.length) {
      const metaMaskProvider = window.ethereum.providers.find(
        (p: any) => p.isMetaMask
      );
      if (metaMaskProvider) {
        return new ethers.BrowserProvider(metaMaskProvider);
      }
    }
    return new ethers.BrowserProvider(window.ethereum);
  }
  return new ethers.JsonRpcProvider('http://localhost:8545');
};

// Get contract instances
const getPatientRegistry = async (withSigner = false) => {
  const provider = getProvider();
  const address = (deployments as any).contracts.PatientRegistry;
  
  if (withSigner) {
    const signer = await provider.getSigner();
    return new ethers.Contract(address, PatientRegistryABI.abi, signer);
  }
  return new ethers.Contract(address, PatientRegistryABI.abi, provider);
};

const getDoctorRegistry = async (withSigner = false) => {
  const provider = getProvider();
  const address = (deployments as any).contracts.DoctorRegistry;
  
  if (withSigner) {
    const signer = await provider.getSigner();
    return new ethers.Contract(address, DoctorRegistryABI.abi, signer);
  }
  return new ethers.Contract(address, DoctorRegistryABI.abi, provider);
};

const getRecordRegistry = async (withSigner = false) => {
  const provider = getProvider();
  const address = (deployments as any).contracts.RecordRegistry;
  
  if (withSigner) {
    const signer = await provider.getSigner();
    return new ethers.Contract(address, RecordRegistryABI.abi, signer);
  }
  return new ethers.Contract(address, RecordRegistryABI.abi, provider);
};

const getAccessControl = async (withSigner = false) => {
  const provider = getProvider();
  const address = (deployments as any).contracts.AccessControl;
  
  if (withSigner) {
    const signer = await provider.getSigner();
    return new ethers.Contract(address, AccessControlABI.abi, signer);
  }
  return new ethers.Contract(address, AccessControlABI.abi, provider);
};

const getAuditLog = async (withSigner = false) => {
  const provider = getProvider();
  const address = (deployments as any).contracts.AuditLog;
  
  if (withSigner) {
    const signer = await provider.getSigner();
    return new ethers.Contract(address, AuditLogABI.abi, signer);
  }
  return new ethers.Contract(address, AuditLogABI.abi, provider);
};

// ============================================
// PATIENT OPERATIONS
// ============================================

export const blockchainAPI = {
  // ========== PATIENT REGISTRATION ==========
  
  registerPatient: async (profileCID: string) => {
    const contract = await getPatientRegistry(true);
    const tx = await contract.registerPatient(profileCID);
    await tx.wait();
    return tx.hash;
  },

  isPatient: async (address: string) => {
  const contract = await getPatientRegistry(false);
  return await contract.isPatient(address); // ✅ Must have await and return
},

  getPatientProfile: async (address: string) => {
    const contract = await getPatientRegistry(false);
    const patient = await contract.patients(address);
    return {
      walletAddress: patient.walletAddress,
      profileCID: patient.profileCID,
      isRegistered: patient.isRegistered,
      registeredAt: Number(patient.registeredAt)
    };
  },

  updatePatientProfile: async (newProfileCID: string) => {
    const contract = await getPatientRegistry(true);
    const tx = await contract.updateProfile(newProfileCID);
    await tx.wait();
    return tx.hash;
  },

  // ========== DOCTOR REGISTRATION ==========

  registerDoctor: async (profileCID: string, licenseNumber: string) => {
    const contract = await getDoctorRegistry(true);
    const tx = await contract.registerDoctor(profileCID, licenseNumber);
    await tx.wait();
    return tx.hash;
  },

  isVerifiedDoctor: async (address: string) => {
  const contract = await getDoctorRegistry(false);
  return await contract.isVerifiedDoctor(address); // ✅ Must have await and return
},

  getDoctorInfo: async (address: string) => {
  const contract = await getDoctorRegistry(false);
  const info = await contract.getDoctorInfo(address);
  return { // ✅ Must return object
    profileCID: info[0],
    status: Number(info[1]),
    registeredAt: Number(info[2]),
    verifiedAt: Number(info[3])
  };
},

  updateDoctorProfile: async (newProfileCID: string) => {
    const contract = await getDoctorRegistry(true);
    const tx = await contract.updateProfile(newProfileCID);
    await tx.wait();
    return tx.hash;
  },

  // Admin functions (only contract deployer)
  verifyDoctor: async (doctorAddress: string) => {
    const contract = await getDoctorRegistry(true);
    const tx = await contract.verifyDoctor(doctorAddress);
    await tx.wait();
    return tx.hash;
  },

  rejectDoctor: async (doctorAddress: string, reason: string) => {
    const contract = await getDoctorRegistry(true);
    const tx = await contract.rejectDoctor(doctorAddress, reason);
    await tx.wait();
    return tx.hash;
  },

  // ========== RECORD MANAGEMENT ==========

  addRecord: async (
    ownerAddress: string,
    dataCID: string,
    encryptedKeyCID: string,
    recordType: number, // 0-5 (General, LabResult, Imaging, Prescription, Diagnosis, Other)
    recordHash: string,
    shortDescription: string
  ) => {
    const contract = await getRecordRegistry(true);
    const tx = await contract.addRecord(
      ownerAddress,
      dataCID,
      encryptedKeyCID,
      recordType,
      recordHash,
      shortDescription
    );
    const receipt = await tx.wait();
    
    // Extract recordId from event
    const event = receipt.logs.find((log: any) => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog?.name === 'RecordAdded';
      } catch {
        return false;
      }
    });
    
    let recordId = null;
    if (event) {
      const parsedLog = contract.interface.parseLog(event);
      recordId = parsedLog?.args[0]; // First arg is recordId
    }
    
    return { txHash: tx.hash, recordId: recordId ? Number(recordId) : null };
  },

  getRecord: async (recordId: number) => {
    const contract = await getRecordRegistry(false);
    const record = await contract.getRecord(recordId);
    return {
      recordId: Number(record.recordId),
      owner: record.owner,
      dataCID: record.dataCID,
      encryptedKeyCID: record.encryptedKeyCID,
      recordType: Number(record.recordType),
      recordHash: record.recordHash,
      shortDescription: record.shortDescription,
      addedBy: record.addedBy,
      createdAt: Number(record.createdAt),
      isActive: record.isActive
    };
  },

  getPatientRecords: async (patientAddress: string) => {
    const contract = await getRecordRegistry(false);
    const recordIds = await contract.getActivePatientRecordIds(patientAddress);
    
    // Fetch details for each record
    const records = await Promise.all(
      recordIds.map(async (id: bigint) => {
        const record = await contract.getRecord(id);
        return {
          recordId: Number(record.recordId),
          owner: record.owner,
          dataCID: record.dataCID,
          encryptedKeyCID: record.encryptedKeyCID,
          recordType: Number(record.recordType),
          recordHash: record.recordHash,
          shortDescription: record.shortDescription,
          addedBy: record.addedBy,
          createdAt: Number(record.createdAt),
          isActive: record.isActive
        };
      })
    );
    
    return records;
  },

  deactivateRecord: async (recordId: number) => {
    const contract = await getRecordRegistry(true);
    const tx = await contract.deactivateRecord(recordId);
    await tx.wait();
    return tx.hash;
  },

  // ========== ACCESS CONTROL ==========

  requestAccess: async (recordId: number, reason: string) => {
    const contract = await getAccessControl(true);
    const tx = await contract.requestAccess(recordId, reason);
    const receipt = await tx.wait();
    
    // Extract accessId from event
    const event = receipt.logs.find((log: any) => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog?.name === 'AccessRequested';
      } catch {
        return false;
      }
    });
    
    let accessId = null;
    if (event) {
      const parsedLog = contract.interface.parseLog(event);
      accessId = parsedLog?.args[0];
    }
    
    return { txHash: tx.hash, accessId: accessId ? Number(accessId) : null };
  },

  grantAccess: async (accessId: number, encryptedKeyCID: string, durationDays: number) => {
    const contract = await getAccessControl(true);
    const tx = await contract.grantAccess(accessId, encryptedKeyCID, durationDays);
    await tx.wait();
    return tx.hash;
  },

  revokeAccess: async (accessId: number) => {
    const contract = await getAccessControl(true);
    const tx = await contract.revokeAccess(accessId);
    await tx.wait();
    return tx.hash;
  },

  hasActiveAccess: async (recordId: number, doctorAddress: string) => {
    const contract = await getAccessControl(false);
    return await contract.hasActiveAccess(recordId, doctorAddress);
  },

  getAccessGrant: async (accessId: number) => {
    const contract = await getAccessControl(false);
    const access = await contract.getAccessGrant(accessId);
    return {
      recordId: Number(access.recordId),
      patient: access.patient,
      doctor: access.doctor,
      encryptedKeyCID: access.encryptedKeyCID,
      grantedAt: Number(access.grantedAt),
      expiresAt: Number(access.expiresAt),
      status: Number(access.status), // 0: None, 1: Requested, 2: Granted, 3: Revoked, 4: Expired
      requestReason: access.requestReason
    };
  },

  getEncryptedKey: async (recordId: number) => {
    const contract = await getAccessControl(false);
    return await contract.getEncryptedKey(recordId);
  },

  getPendingRequests: async (patientAddress: string) => {
    const contract = await getAccessControl(false);
    const accessIds = await contract.getPendingRequests(patientAddress);
    
    // Fetch details for each request
    const requests = await Promise.all(
      accessIds.map(async (id: bigint) => {
        const access = await contract.getAccessGrant(id);
        return {
          accessId: Number(id),
          recordId: Number(access.recordId),
          patient: access.patient,
          doctor: access.doctor,
          status: Number(access.status),
          requestReason: access.requestReason
        };
      })
    );
    
    return requests;
  },

  getDoctorAccessibleRecords: async (doctorAddress: string) => {
    const contract = await getAccessControl(false);
    const recordIds = await contract.getDoctorAccessibleRecords(doctorAddress);
    
    // Fetch record details
    const recordContract = await getRecordRegistry(false);
    const records = await Promise.all(
      recordIds.map(async (id: bigint) => {
        const record = await recordContract.getRecord(id);
        return {
          recordId: Number(record.recordId),
          owner: record.owner,
          dataCID: record.dataCID,
          recordType: Number(record.recordType),
          shortDescription: record.shortDescription,
          createdAt: Number(record.createdAt)
        };
      })
    );
    
    return records;
  },

  // ========== AUDIT LOGGING ==========

  logAuditEvent: async (
    recordId: number,
    actor: string,
    actionType: number, // 0-6 (RecordViewed, RecordAdded, etc.)
    actionHash: string
  ) => {
    const contract = await getAuditLog(true);
    const tx = await contract.logEvent(recordId, actor, actionType, actionHash);
    await tx.wait();
    return tx.hash;
  },

  logDetailedAudit: async (
    recordId: number,
    actor: string,
    actionType: number,
    detailsCID: string
  ) => {
    const contract = await getAuditLog(true);
    const tx = await contract.logDetailed(recordId, actor, actionType, detailsCID);
    await tx.wait();
    return tx.hash;
  }
};

// Helper function to convert record type number to string
export const getRecordTypeName = (type: number): string => {
  const types = ['General', 'Lab Result', 'Imaging', 'Prescription', 'Diagnosis', 'Other'];
  return types[type] || 'Unknown';
};

// Helper function to convert verification status to string
export const getVerificationStatusName = (status: number): string => {
  const statuses = ['Pending', 'Verified', 'Rejected', 'Suspended'];
  return statuses[status] || 'Unknown';
};

// Helper function to convert access status to string
export const getAccessStatusName = (status: number): string => {
  const statuses = ['None', 'Requested', 'Granted', 'Revoked', 'Expired'];
  return statuses[status] || 'Unknown';
};