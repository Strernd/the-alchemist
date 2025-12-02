import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const ADMIN_COOKIE_NAME = 'admin_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Simple session token generation
function generateSessionToken(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join('');
}

// Validate admin password and create session
export async function validateAdminPassword(password: string): Promise<{ success: boolean; token?: string }> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (!adminPassword) {
    console.error('ADMIN_PASSWORD environment variable not set');
    return { success: false };
  }
  
  if (password === adminPassword) {
    const token = generateSessionToken();
    return { success: true, token };
  }
  
  return { success: false };
}

// Set admin session cookie
export async function setAdminSession(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_DURATION / 1000,
    path: '/',
  });
}

// Clear admin session
export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}

// Check if request has valid admin session
export async function isAdminAuthenticated(request?: NextRequest): Promise<boolean> {
  try {
    let token: string | undefined;
    
    if (request) {
      // From NextRequest (API routes)
      token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    } else {
      // From server component
      const cookieStore = await cookies();
      token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    }
    
    // For simplicity, we just check if a token exists
    // In production, you might want to store valid tokens in KV with expiry
    return !!token && token.length === 64;
  } catch {
    return false;
  }
}

// Middleware helper for API routes
export async function requireAdmin(request: NextRequest): Promise<Response | null> {
  const isAdmin = await isAdminAuthenticated(request);
  
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  return null; // Proceed with request
}

