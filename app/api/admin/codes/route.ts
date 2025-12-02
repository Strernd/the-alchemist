import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { requireAdmin } from '@/lib/admin-auth';
import { AccessCode, AccessCodeCreateInput, generateAccessCode, getCodeKey, getCodePattern } from '@/lib/access-control';

// GET - List all access codes
export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    // Get all keys matching thealchemist:access_code:*
    const keys = await kv.keys(getCodePattern());
    
    if (keys.length === 0) {
      return NextResponse.json({ codes: [] });
    }
    
    // Fetch all codes
    const codes: AccessCode[] = [];
    for (const key of keys) {
      const code = await kv.get<AccessCode>(key);
      if (code) {
        codes.push(code);
      }
    }
    
    // Sort by creation date (newest first)
    codes.sort((a, b) => b.createdAt - a.createdAt);
    
    return NextResponse.json({ codes });
  } catch (error) {
    console.error('Error listing codes:', error);
    return NextResponse.json({ error: 'Failed to list codes' }, { status: 500 });
  }
}

// POST - Create new access code
export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const input: AccessCodeCreateInput = await request.json();
    
    // Validate input
    if (!input.maxGames || input.maxGames < 1) {
      return NextResponse.json({ error: 'maxGames must be at least 1' }, { status: 400 });
    }
    if (!input.maxModelTier || ![1, 2, 3, 4, 5].includes(input.maxModelTier)) {
      return NextResponse.json({ error: 'maxModelTier must be 1-5' }, { status: 400 });
    }
    if (!input.maxDays || input.maxDays < 1) {
      return NextResponse.json({ error: 'maxDays must be at least 1' }, { status: 400 });
    }
    
    // Generate unique code
    let code: string;
    let attempts = 0;
    do {
      code = generateAccessCode();
      const existing = await kv.get(getCodeKey(code));
      if (!existing) break;
      attempts++;
    } while (attempts < 10);
    
    if (attempts >= 10) {
      return NextResponse.json({ error: 'Failed to generate unique code' }, { status: 500 });
    }
    
    const accessCode: AccessCode = {
      code,
      maxGames: input.maxGames,
      maxModelTier: input.maxModelTier,
      maxDays: input.maxDays,
      usedGames: 0,
      createdAt: Date.now(),
      note: input.note,
    };
    
    await kv.set(getCodeKey(code), accessCode);
    
    return NextResponse.json({ code: accessCode });
  } catch (error) {
    console.error('Error creating code:', error);
    return NextResponse.json({ error: 'Failed to create code' }, { status: 500 });
  }
}

