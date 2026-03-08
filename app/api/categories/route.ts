import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  try {
    const rows = db.prepare('SELECT * FROM categories ORDER BY parent_id NULLS FIRST, name').all();
    return NextResponse.json({ data: rows, error: null });
  } catch (err: any) {
    return NextResponse.json({ data: null, error: err.message }, { status: 500 });
  }
}
