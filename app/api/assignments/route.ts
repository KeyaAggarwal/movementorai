import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { addAssignment, deactivateAssignment, listAssignments } from '@/lib/memory-store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get('patient_id');
  if (!patientId) return NextResponse.json({ data: null, error: 'patient_id required' }, { status: 400 });

  const data = listAssignments(patientId);
  return NextResponse.json({ data, error: null });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { patient_id, exercise_id, sets_per_day, reps_per_set, duration_days } = body;
  if (!patient_id || !exercise_id) return NextResponse.json({ data: null, error: 'patient_id and exercise_id required' }, { status: 400 });

  const data = addAssignment({
    patient_id,
    exercise_id,
    sets_per_day,
    reps_per_set,
    duration_days,
  });
  return NextResponse.json({ data, error: null }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ data: null, error: 'id required' }, { status: 400 });

  const removed = deactivateAssignment(id);
  if (!removed) {
    return NextResponse.json({ data: null, error: 'assignment not found in memory' }, { status: 404 });
  }

  return NextResponse.json({ data: { id }, error: null });
}
