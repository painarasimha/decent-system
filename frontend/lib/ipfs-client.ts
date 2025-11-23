import { storage } from './storage';

const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';

export interface IPFSUploadResult {
  cid: string;
  size: number;
  timestamp: string;
}

/**
 * Upload file to IPFS via backend API
 */
export async function uploadFileToIPFS(
  file: File | Blob,
  metadata?: Record<string, any>
): Promise<IPFSUploadResult> {
  const token = storage.getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const formData = new FormData();
  formData.append('file', file);
  
  if (metadata) {
    formData.append('metadata', JSON.stringify(metadata));
  }

  const response = await fetch('/api/ipfs/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Upload failed');
  }

  return await response.json();
}

/**
 * Upload JSON to IPFS via backend API
 */
export async function uploadJSONToIPFS(
  json: object,
  metadata?: Record<string, any>
): Promise<IPFSUploadResult> {
  const token = storage.getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/ipfs/upload-json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ json, metadata }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Upload failed');
  }

  return await response.json();
}

/**
 * Download file from IPFS
 */
export async function downloadFromIPFS(cid: string): Promise<Blob> {
  const url = `${PINATA_GATEWAY}${cid}`;
  
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`IPFS download failed: ${response.statusText}`);
  }

  return await response.blob();
}

/**
 * Download JSON from IPFS
 */
export async function downloadJSONFromIPFS(cid: string): Promise<any> {
  const url = `${PINATA_GATEWAY}${cid}`;
  
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`IPFS JSON download failed: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Get IPFS gateway URL for a CID
 */
export function getIPFSUrl(cid: string): string {
  return `${PINATA_GATEWAY}${cid}`;
}