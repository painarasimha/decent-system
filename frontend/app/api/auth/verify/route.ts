import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { nonceStore } from '../nonce/route';
import { generateToken } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  try {
    const { address, signature, role } = await request.json();

    if (!address || !signature || !role) {
      return NextResponse.json(
        { error: 'Address, signature, and role required' },
        { status: 400 }
      );
    }

    if (!['patient', 'doctor'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be patient or doctor' },
        { status: 400 }
      );
    }

    // Get stored nonce
    const nonce = nonceStore.get(address.toLowerCase());
    if (!nonce) {
      return NextResponse.json(
        { error: 'Nonce not found. Please request a new nonce.' },
        { status: 401 }
      );
    }

    // Verify signature
    const message = `Sign this message to authenticate with AI Decentralized HRS.\n\nNonce: ${nonce}\nRole: ${role}`;
    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Clear used nonce
    nonceStore.delete(address.toLowerCase());

    // Generate JWT with role
    const token = await generateToken({
      address: address.toLowerCase(),
      role: role as 'patient' | 'doctor',
    });

    return NextResponse.json({
      token,
      user: {
        address: address.toLowerCase(),
        role,
      },
    });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}