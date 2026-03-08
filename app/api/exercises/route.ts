import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  createStoredExercise,
  deleteStoredExerciseById,
  getStoredExerciseById,
  listStoredExercises,
} from '@/lib/exercise-file-store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const id = searchParams.get('id');
  const includeMotion = searchParams.get('include_motion') === '1';

  if (id) {
    const exercise = await getStoredExerciseById(id, includeMotion);
    if (!exercise) {
      return NextResponse.json({ data: null, error: 'exercise not found' }, { status: 404 });
    }
    return NextResponse.json({ data: exercise, error: null });
  }

  const data = await listStoredExercises(category);
  return NextResponse.json({ data, error: null });
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const name = String(formData.get('name') ?? '').trim();
    if (!name) return NextResponse.json({ data: null, error: 'name is required' }, { status: 400 });

    const parseJson = (value: FormDataEntryValue | null) => {
      if (typeof value !== 'string' || !value) return null;
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    };

    const videoFile = formData.get('video_file');
    const thumbnailFile = formData.get('thumbnail_file');
    const stored = await createStoredExercise({
      name,
      category_id: (formData.get('category_id') as string) || null,
      description: (formData.get('description') as string) || '',
      body_part: (formData.get('body_part') as string) || '',
      injury_category: (formData.get('injury_category') as string) || '',
      focus_joints: (parseJson(formData.get('focus_joints')) as string[] | null) ?? [],
      steps: (parseJson(formData.get('steps')) as any[] | null) ?? [],
      created_by: (formData.get('created_by') as string) || null,
      motionData: parseJson(formData.get('motion_data')),
      videoFile: videoFile instanceof File ? videoFile : null,
      thumbnailFile: thumbnailFile instanceof File ? thumbnailFile : null,
    });

    return NextResponse.json({ data: stored, error: null }, { status: 201 });
  }

  const body = await req.json();
  const { name, category_id, description, body_part, injury_category, focus_joints, steps, motion_data, created_by } = body;
  if (!name) return NextResponse.json({ data: null, error: 'name is required' }, { status: 400 });

  const stored = await createStoredExercise({
    name,
    category_id,
    description,
    body_part,
    injury_category,
    focus_joints,
    steps,
    motionData: motion_data,
    created_by,
    videoFile: null,
    thumbnailFile: null,
  });

  return NextResponse.json({ data: stored, error: null }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ data: null, error: 'id required' }, { status: 400 });

  const removed = await deleteStoredExerciseById(id);
  if (!removed) {
    return NextResponse.json({ data: null, error: 'exercise not found' }, { status: 404 });
  }

  return NextResponse.json({ data: { id }, error: null });
}
