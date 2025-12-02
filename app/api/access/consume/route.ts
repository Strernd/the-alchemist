import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { AccessCode, getCodeKey, normalizeCode } from '@/lib/access-control';

// POST - Consume one game from an access code
export async function POST(request: NextRequest) {
  try {
    const { code: rawCode } = await request.json();
    
    if (!rawCode) {
      return NextResponse.json({ error: 'Access code required' }, { status: 400 });
    }
    
    const code = normalizeCode(rawCode);
    const key = getCodeKey(code);
    
    const accessCode = await kv.get<AccessCode>(key);
    
    if (!accessCode) {
      return NextResponse.json({ error: 'Invalid access code' }, { status: 404 });
    }
    
    const remainingGames = accessCode.maxGames - accessCode.usedGames;
    
    if (remainingGames <= 0) {
      return NextResponse.json({ error: 'No remaining games' }, { status: 403 });
    }
    
    // Increment used games
    const updatedCode: AccessCode = {
      ...accessCode,
      usedGames: accessCode.usedGames + 1,
    };
    
    await kv.set(key, updatedCode);
    
    return NextResponse.json({ 
      success: true,
      remainingGames: updatedCode.maxGames - updatedCode.usedGames,
    });
  } catch (error) {
    console.error('Error consuming code:', error);
    return NextResponse.json({ error: 'Failed to consume code' }, { status: 500 });
  }
}

