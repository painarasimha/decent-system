import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { blockchainAPI } from '@/lib/blockchain-api';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get patient address from query params (for doctors) or use own address (for patients)
    const { searchParams } = new URL(request.url);
    const patientAddress = searchParams.get('patientAddress') || payload.address;

    // Get records from blockchain
    const records = await blockchainAPI.getPatientRecords(patientAddress);

    return NextResponse.json({ 
      records,
      patientAddress 
    });
  } catch (error: any) {
    console.error('Error fetching health records:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch health records' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { recordHash, patientAddress } = await request.json();

    if (!recordHash) {
      return NextResponse.json(
        { error: 'Record hash required' },
        { status: 400 }
      );
    }

    // Determine target address
    const targetAddress = payload.role === 'doctor' && patientAddress
      ? patientAddress
      : payload.address;

    // Add record to blockchain
    const txHash = await blockchainAPI.addHealthRecord(
      targetAddress,
      recordHash
    );

    return NextResponse.json({ 
      success: true, 
      transactionHash: txHash,
      patientAddress: targetAddress
    });
  } catch (error: any) {
    console.error('Error adding health record:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add health record' },
      { status: 500 }
    );
  }
}