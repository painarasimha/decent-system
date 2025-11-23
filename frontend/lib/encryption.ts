/**
 * Client-Side Encryption using Web Crypto API
 * AES-GCM 256-bit encryption
 */

export interface EncryptedData {
  ciphertext: string;      // Base64 encoded
  iv: string;              // Initialization vector (Base64)
  salt: string;            // Salt for key derivation (Base64)
}

/**
 * Generate a random encryption key
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Export key to base64 string for storage
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(exported);
}

/**
 * Import key from base64 string
 */
export async function importKey(keyString: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(keyString);
  return await window.crypto.subtle.importKey(
    'raw',
    keyBuffer,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data with AES-GCM
 */
export async function encryptData(
  data: string | ArrayBuffer,
  key: CryptoKey
): Promise<EncryptedData> {
  // Generate random IV (12 bytes for GCM)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Convert data to ArrayBuffer if string
  const dataBuffer = typeof data === 'string' 
    ? new TextEncoder().encode(data) 
    : data;

  // Encrypt
  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    dataBuffer
  );

  // Generate salt for reference (not used in this simple implementation but good practice)
  const salt = window.crypto.getRandomValues(new Uint8Array(16));

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv.buffer),
    salt: arrayBufferToBase64(salt.buffer),
  };
}

/**
 * Decrypt data with AES-GCM
 */
export async function decryptData(
  encryptedData: EncryptedData,
  key: CryptoKey
): Promise<ArrayBuffer> {
  const ciphertext = base64ToArrayBuffer(encryptedData.ciphertext);
  const iv = base64ToArrayBuffer(encryptedData.iv);

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    ciphertext
  );

  return decrypted;
}

/**
 * Encrypt file (returns encrypted ArrayBuffer)
 */
export async function encryptFile(file: File): Promise<{
  encryptedData: EncryptedData;
  key: CryptoKey;
  originalFileName: string;
  originalFileType: string;
}> {
  // Generate encryption key
  const key = await generateEncryptionKey();

  // Read file as ArrayBuffer
  const fileBuffer = await file.arrayBuffer();

  // Encrypt
  const encryptedData = await encryptData(fileBuffer, key);

  return {
    encryptedData,
    key,
    originalFileName: file.name,
    originalFileType: file.type,
  };
}

/**
 * Decrypt file (returns File object)
 */
export async function decryptFile(
  encryptedData: EncryptedData,
  key: CryptoKey,
  fileName: string,
  fileType: string
): Promise<File> {
  const decryptedBuffer = await decryptData(encryptedData, key);
  const blob = new Blob([decryptedBuffer], { type: fileType });
  return new File([blob], fileName, { type: fileType });
}

/**
 * Encrypt symmetric key with public key (for sharing)
 * Uses RSA-OAEP
 */
export async function encryptKeyForRecipient(
  symmetricKey: CryptoKey,
  recipientPublicKey: CryptoKey
): Promise<string> {
  const exportedKey = await window.crypto.subtle.exportKey('raw', symmetricKey);
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    recipientPublicKey,
    exportedKey
  );
  return arrayBufferToBase64(encrypted);
}

/**
 * Decrypt symmetric key with private key
 */
export async function decryptKeyFromSender(
  encryptedKey: string,
  recipientPrivateKey: CryptoKey
): Promise<CryptoKey> {
  const encryptedBuffer = base64ToArrayBuffer(encryptedKey);
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'RSA-OAEP',
    },
    recipientPrivateKey,
    encryptedBuffer
  );
  return await window.crypto.subtle.importKey(
    'raw',
    decrypted,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate RSA key pair for a user (for key sharing)
 */
export async function generateUserKeyPair(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Export public key to base64
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('spki', publicKey);
  return arrayBufferToBase64(exported);
}

/**
 * Import public key from base64
 */
export async function importPublicKey(keyString: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(keyString);
  return await window.crypto.subtle.importKey(
    'spki',
    keyBuffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['encrypt']
  );
}

/**
 * Export private key to base64
 */
export async function exportPrivateKey(privateKey: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('pkcs8', privateKey);
  return arrayBufferToBase64(exported);
}

/**
 * Import private key from base64
 */
export async function importPrivateKey(keyString: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(keyString);
  return await window.crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['decrypt']
  );
}

/**
 * Calculate SHA-256 hash of file (for integrity verification)
 */
export async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
  return arrayBufferToHex(hashBuffer);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  // Handle both ArrayBuffer and Uint8Array
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create encrypted JSON metadata for IPFS
 */
export function createEncryptedMetadata(
  encryptedData: EncryptedData,
  fileName: string,
  fileType: string,
  fileSize: number
): string {
  const metadata = {
    version: '1.0',
    encrypted: true,
    algorithm: 'AES-GCM-256',
    ciphertext: encryptedData.ciphertext,
    iv: encryptedData.iv,
    salt: encryptedData.salt,
    originalFileName: fileName,
    originalFileType: fileType,
    originalFileSize: fileSize,
    encryptedAt: new Date().toISOString(),
  };
  return JSON.stringify(metadata);
}

/**
 * Parse encrypted metadata from IPFS
 */
export function parseEncryptedMetadata(metadataString: string): {
  encryptedData: EncryptedData;
  fileName: string;
  fileType: string;
  fileSize: number;
} {
  const metadata = JSON.parse(metadataString);
  return {
    encryptedData: {
      ciphertext: metadata.ciphertext,
      iv: metadata.iv,
      salt: metadata.salt,
    },
    fileName: metadata.originalFileName,
    fileType: metadata.originalFileType,
    fileSize: metadata.originalFileSize,
  };
}