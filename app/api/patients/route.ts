import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { addPatient, listPatients } from '@/lib/memory-store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const therapistId = searchParams.get('therapist_id');

  const data = listPatients(therapistId);
  return NextResponse.json({ data, error: null });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { full_name, email, injury_notes, therapist_id } = body;
  if (!full_name || !email) return NextResponse.json({ data: null, error: 'full_name and email required' }, { status: 400 });

  const data = addPatient({
    full_name,
    email,
    injury_notes,
    therapist_id,
  });

  return NextResponse.json({ data, error: null }, { status: 201 });
}
