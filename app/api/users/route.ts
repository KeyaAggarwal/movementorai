/**
 * Simple local auth — no JWT, just session cookie with user ID.
 * Good enough for local dev; swap for NextAuth or similar for production.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDb, uid } from '@/lib/db';
import { cookies } from 'next/headers';

// GET /api/users?action=me  → current user from session cookie
export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  if (action === 'me') {
    const cookieStore = cookies();
    const userId = cookieStore.get('physioai_user_id')?.value;
    if (!userId) return NextResponse.json({ data: null, error: 'not logged in' }, { status: 401 });
    const user = db.prepare('SELECT id, email, full_name, role FROM users WHERE id = ?').get(userId);
    if (!user) return NextResponse.json({ data: null, error: 'user not found' }, { status: 404 });
    return NextResponse.json({ data: user, error: null });
  }

  // List all users (dev helper)
  const rows = db.prepare('SELECT id, email, full_name, role, created_at FROM users ORDER BY created_at DESC').all();
  return NextResponse.json({ data: rows, error: null });
}

// POST /api/users  body: { action: 'login'|'register', email, password, full_name?, role? }
export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { action, email, password, full_name, role } = body;

  if (action === 'login') {
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?').get(email, password) as any;
    if (!user) return NextResponse.json({ data: null, error: 'Invalid email or password' }, { status: 401 });

    const res = NextResponse.json({ data: { id: user.id, email: user.email, full_name: user.full_name, role: user.role }, error: null });
    res.cookies.set('physioai_user_id', user.id, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 });
    return res;
  }

  if (action === 'register') {
    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ data: null, error: 'email, password, full_name, and role are required' }, { status: 400 });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return NextResponse.json({ data: null, error: 'Email already registered' }, { status: 409 });

    try {
      const userId = uid();
      db.prepare('INSERT INTO users (id, email, full_name, role, password) VALUES (?, ?, ?, ?, ?)').run(userId, email, full_name, role, password);

      if (role === 'therapist') {
        db.prepare('INSERT INTO therapists (id, user_id) VALUES (?, ?)').run(uid(), userId);
      } else if (role === 'patient') {
        db.prepare('INSERT INTO patients (id, user_id) VALUES (?, ?)').run(uid(), userId);
      }

      const res = NextResponse.json({ data: { id: userId, email, full_name, role }, error: null }, { status: 201 });
      res.cookies.set('physioai_user_id', userId, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 });
      return res;
    } catch (err: any) {
      return NextResponse.json({ data: null, error: err.message }, { status: 500 });
    }
  }

  if (action === 'logout') {
    const res = NextResponse.json({ data: null, error: null });
    res.cookies.delete('physioai_user_id');
    return res;
  }

  return NextResponse.json({ data: null, error: 'Unknown action' }, { status: 400 });
}
