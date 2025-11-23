export enum RecordType {
  General = 0,
  LabResult = 1,
  Imaging = 2,
  Prescription = 3,
  Diagnosis = 4,
  Other = 5,
}

export interface HealthRecord {
  recordId: number;
  owner: string;
  dataCID: string;
  encryptedKeyCID: string;
  recordType: RecordType;
  recordHash: string;
  shortDescription: string;
  addedBy: string;
  createdAt: number;
  isActive: boolean;
}

export interface AccessRequest {
  accessId: number;
  recordId: number;
  patient: string;
  doctor: string;
  status: AccessStatus;
  requestReason: string;
  encryptedKeyCID?: string;
  grantedAt?: number;
  expiresAt?: number;
}

export enum AccessStatus {
  None = 0,
  Requested = 1,
  Granted = 2,
  Revoked = 3,
  Expired = 4,
}

export enum VerificationStatus {
  Pending = 0,
  Verified = 1,
  Rejected = 2,
  Suspended = 3,
}