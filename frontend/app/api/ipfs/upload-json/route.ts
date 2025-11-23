import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get JSON data
    const body = await request.json();
    const { json, metadata } = body;

    if (!json) {
      return NextResponse.json({ error: 'No JSON data provided' }, { status: 400 });
    }

    // Upload to Pinata
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
          name: metadata.name || 'health-record-key',
          keyvalues: {
            ...metadata,
            uploadedBy: payload.address,
            uploadedAt: new Date().toISOString(),
          },
        } : undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Pinata JSON upload failed: ${error.error || response.statusText}`);
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      cid: data.IpfsHash,
      size: data.PinSize,
      timestamp: data.Timestamp,
    });
  } catch (error: any) {
    console.error('IPFS JSON upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}