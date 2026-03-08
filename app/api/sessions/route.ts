import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDb, parseJsonCols, uid } from '@/lib/db';

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const { patient_id, assignment_id, exercise_id, duration_seconds, reps_completed, sets_completed, accuracy_score, avg_rom, max_rom, joint_errors } = body;

  if (!patient_id || !exercise_id) return NextResponse.json({ data: null, error: 'patient_id and exercise_id required' }, { status: 400 });

  try {
    const id = uid();
    db.prepare(`
      INSERT INTO exercise_sessions (id, patient_id, assignment_id, exercise_id, timestamp, duration_seconds, reps_completed, sets_completed, accuracy_score, avg_rom, max_rom, joint_errors)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, patient_id, assignment_id ?? null, exercise_id,
      new Date().toISOString(),
      duration_seconds ?? 0, reps_completed ?? 0, sets_completed ?? 0,
      accuracy_score ?? 0, avg_rom ?? 0, max_rom ?? 0,
      JSON.stringify(joint_errors ?? {}),
    );

    const data = parseJsonCols(db.prepare('SELECT * FROM exercise_sessions WHERE id = ?').get(id) as any, ['joint_errors']);
    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ data: null, error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get('patient_id');
  const exerciseId = searchParams.get('exercise_id');
  if (!patientId) return NextResponse.json({ data: null, error: 'patient_id required' }, { status: 400 });

  try {
    const sql = exerciseId
      ? `SELECT * FROM exercise_sessions WHERE patient_id = ? AND exercise_id = ? ORDER BY timestamp DESC LIMIT 50`
      : `SELECT * FROM exercise_sessions WHERE patient_id = ? ORDER BY timestamp DESC LIMIT 50`;

    const rows = exerciseId
      ? (db.prepare(sql).all(patientId, exerciseId) as any[])
      : (db.prepare(sql).all(patientId) as any[]);

    const data = rows.map(r => parseJsonCols(r, ['joint_errors']));
    return NextResponse.json({ data, error: null });
  } catch (err: any) {
    return NextResponse.json({ data: null, error: err.message }, { status: 500 });
  }
}
