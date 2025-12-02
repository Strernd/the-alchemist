import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { requireAdmin } from '@/lib/admin-auth';
import { getCodeKey } from '@/lib/access-control';

// DELETE - Delete an access code
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const { code } = await params;
    const key = getCodeKey(code);
    
    const existing = await kv.get(key);
    if (!existing) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }
    
    await kv.del(key);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting code:', error);
    return NextResponse.json({ error: 'Failed to delete code' }, { status: 500 });
  }
}

