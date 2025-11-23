import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

// In production, use Redis or database
const nonceStore = new Map<string, string>();

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();
    
    if (!address) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    // Generate random nonce
    const nonce = randomBytes(32).toString('hex');
    
    // Store nonce with address (expires in 5 minutes)
    nonceStore.set(address.toLowerCase(), nonce);
    
    // Auto-cleanup after 5 minutes
    setTimeout(() => {
      nonceStore.delete(address.toLowerCase());
    }, 5 * 60 * 1000);
    
    return NextResponse.json({ nonce });
  } catch (error) {
    console.error('Nonce generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate nonce' },
      { status: 500 }
    );
  }
}

export { nonceStore };