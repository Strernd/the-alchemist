import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { AccessCode, AccessValidation, getCodeKey, normalizeCode } from '@/lib/access-control';

export async function POST(request: NextRequest) {
  try {
    const { code: rawCode } = await request.json();
    
    if (!rawCode) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Access code required' 
      } as AccessValidation);
    }
    
    const code = normalizeCode(rawCode);
    const key = getCodeKey(code);
    
    const accessCode = await kv.get<AccessCode>(key);
    
    if (!accessCode) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Invalid access code' 
      } as AccessValidation);
    }
    
    const remainingGames = accessCode.maxGames - accessCode.usedGames;
    
    if (remainingGames <= 0) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Access code has no remaining games' 
      } as AccessValidation);
    }
    
    return NextResponse.json({ 
      valid: true,
      code: accessCode,
      remainingGames,
    } as AccessValidation);
  } catch (error) {
    console.error('Error validating code:', error);
    return NextResponse.json({ 
      valid: false, 
      error: 'Failed to validate code' 
    } as AccessValidation);
  }
}

