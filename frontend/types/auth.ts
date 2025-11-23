export interface User {
  address: string;
  role: 'patient' | 'doctor' | 'admin';
  nonce?: string;
  isRegistered?: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface WalletConnectionResult {
  address: string;
  chainId: number;
  provider: any;
  signer: any;
}

export interface HealthRecord {
  hash: string;
  timestamp: number;
  addedBy: string;
}