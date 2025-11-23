import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, generateToken } from '@/lib/jwt';

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

    const { role } = await request.json();

    if (!['patient', 'doctor'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Generate new token with updated role
    const newToken = await generateToken({
      address: payload.address,
      role: role as 'patient' | 'doctor',
    });

    return NextResponse.json({
      token: newToken,
      user: {
        address: payload.address,
        role,
      },
    });
  } catch (error) {
    console.error('Set role error:', error);
    return NextResponse.json(
      { error: 'Failed to set role' },
      { status: 500 }
    );
  }
}