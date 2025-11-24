import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { json, metadata } = body;

    if (!json) {
      return NextResponse.json(
        { error: 'No JSON data provided' },
        { status: 400 }
      );
    }

    // ✅ OPTIONAL AUTHENTICATION - Allow both authenticated and unauthenticated requests
    let uploaderAddress = 'registration';
    const authHeader = request.headers.get('authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = await verifyToken(token);
        if (payload) {
          uploaderAddress = payload.address;
        }
      } catch (err) {
        // Token invalid, but we continue anyway (for registration)
        console.log('Invalid token during upload, continuing as unauthenticated');
      }
    }

    // Validate Pinata credentials
    if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
      console.error('Pinata credentials missing!');
      return NextResponse.json(
        { error: 'IPFS service not configured. Please check environment variables.' },
        { status: 500 }
      );
    }

    // Upload to Pinata
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_API_KEY,
      },
      body: JSON.stringify({
        pinataContent: json,
        pinataMetadata: metadata ? {
          name: metadata.name || 'health-record-data',
          keyvalues: {
            ...metadata,
            uploadedBy: uploaderAddress,
            uploadedAt: new Date().toISOString(),
          },
        } : undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Pinata API error:', errorText);
      
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { error: errorText };
      }
      
      throw new Error(`Pinata upload failed: ${error.error || response.statusText}`);
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