/**
 * IPFS Service using Pinata
 * Handles file upload, download, and pinning
 */

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;
const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';

export interface IPFSUploadResult {
  cid: string;
  size: number;
  timestamp: string;
}

/**
 * Upload file to IPFS via Pinata
 */
export async function uploadToIPFS(
  file: File | Blob,
  metadata?: Record<string, any>
): Promise<IPFSUploadResult> {
  const formData = new FormData();
  formData.append('file', file);

  if (metadata) {
    formData.append('pinataMetadata', JSON.stringify({
      name: metadata.name || 'health-record',
      keyvalues: metadata,
    }));
  }

  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      'pinata_api_key': PINATA_API_KEY!,
      'pinata_secret_api_key': PINATA_SECRET_API_KEY!,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`IPFS upload failed: ${error.error || response.statusText}`);
  }

  const data = await response.json();

  return {
    cid: data.IpfsHash,
    size: data.PinSize,
    timestamp: data.Timestamp,
  };
}

/**
 * Upload JSON data to IPFS
 */
export async function uploadJSONToIPFS(
  json: object,
  metadata?: Record<string, any>
): Promise<IPFSUploadResult> {
  const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'pinata_api_key': PINATA_API_KEY!,
      'pinata_secret_api_key': PINATA_SECRET_API_KEY!,
    },
    body: JSON.stringify({
      pinataContent: json,
      pinataMetadata: metadata ? {
        name: metadata.name || 'health-record-metadata',
        keyvalues: metadata,
      } : undefined,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`IPFS JSON upload failed: ${error.error || response.statusText}`);
  }

  const data = await response.json();

  return {
    cid: data.IpfsHash,
    size: data.PinSize,
    timestamp: data.Timestamp,
  };
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

/**
 * Unpin file from IPFS (remove from Pinata)
 */
export async function unpinFromIPFS(cid: string): Promise<void> {
  const response = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
    method: 'DELETE',
    headers: {
      'pinata_api_key': PINATA_API_KEY!,
      'pinata_secret_api_key': PINATA_SECRET_API_KEY!,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`IPFS unpin failed: ${error || response.statusText}`);
  }
}

/**
 * Test Pinata connection
 */
export async function testPinataConnection(): Promise<boolean> {
  try {
    const response = await fetch('https://api.pinata.cloud/data/testAuthentication', {
      method: 'GET',
      headers: {
        'pinata_api_key': PINATA_API_KEY!,
        'pinata_secret_api_key': PINATA_SECRET_API_KEY!,
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Pinata connection test failed:', error);
    return false;
  }
}