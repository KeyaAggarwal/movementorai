import fs from 'fs/promises';
import path from 'path';
import { uid } from '@/lib/db';

type CreateExerciseInput = {
  name: string;
  category_id?: string | null;
  description?: string;
  body_part?: string;
  injury_category?: string;
  focus_joints?: string[];
  steps?: any[];
  created_by?: string | null;
  videoFile?: File | null;
  thumbnailFile?: File | null;
  motionData?: unknown;
};

export type StoredExercise = {
  id: string;
  name: string;
  category_id: string | null;
  category_name: string | null;
  description: string;
  body_part: string;
  injury_category: string;
  focus_joints: string[];
  steps: any[];
  video_url: string;
  motion_data_url: string;
  thumbnail_url: string;
  created_by: string | null;
  created_at: string;
};

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const EXERCISE_ROOT = path.join(PUBLIC_DIR, 'local-exercises');
const INDEX_FILE = path.join(EXERCISE_ROOT, 'index.json');

async function ensureStore() {
  await fs.mkdir(EXERCISE_ROOT, { recursive: true });
  try {
    await fs.access(INDEX_FILE);
  } catch {
    await fs.writeFile(INDEX_FILE, '[]', 'utf-8');
  }
}

async function readIndex(): Promise<StoredExercise[]> {
  await ensureStore();
  const raw = await fs.readFile(INDEX_FILE, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeIndex(exercises: StoredExercise[]) {
  await ensureStore();
  await fs.writeFile(INDEX_FILE, JSON.stringify(exercises, null, 2), 'utf-8');
}

function toPublicPath(absolutePath: string) {
  return absolutePath.replace(PUBLIC_DIR, '').replace(/\\/g, '/');
}

function normalizeList(value: unknown): any[] {
  if (!Array.isArray(value)) return [];
  return value;
}

export async function listStoredExercises(categoryId?: string | null): Promise<StoredExercise[]> {
  const index = await readIndex();
  const filtered = categoryId ? index.filter((exercise) => exercise.category_id === categoryId) : index;
  return [...filtered].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getStoredExerciseById(id: string, includeMotion = false): Promise<(StoredExercise & { motion_data?: unknown }) | null> {
  const index = await readIndex();
  const found = index.find((exercise) => exercise.id === id);
  if (!found) return null;
  if (!includeMotion) return found;

  try {
    const relativeMotionPath = found.motion_data_url.replace(/^\/+/, '');
    const motionFile = path.join(PUBLIC_DIR, relativeMotionPath);
    const raw = await fs.readFile(motionFile, 'utf-8');
    const motion_data = JSON.parse(raw);
    return { ...found, motion_data };
  } catch {
    return { ...found, motion_data: null };
  }
}

export async function createStoredExercise(input: CreateExerciseInput): Promise<StoredExercise> {
  await ensureStore();

  const id = uid();
  const created_at = new Date().toISOString();
  const exerciseDir = path.join(EXERCISE_ROOT, id);
  await fs.mkdir(exerciseDir, { recursive: true });

  let videoPublicPath = '';
  if (input.videoFile) {
    const ext = path.extname(input.videoFile.name || '').toLowerCase() || '.mp4';
    const videoFileName = `video${ext}`;
    const videoAbsolutePath = path.join(exerciseDir, videoFileName);
    const buffer = Buffer.from(await input.videoFile.arrayBuffer());
    await fs.writeFile(videoAbsolutePath, buffer);
    videoPublicPath = toPublicPath(videoAbsolutePath);
  }

  let thumbnailPublicPath = '';
  if (input.thumbnailFile) {
    const thumbExt = path.extname(input.thumbnailFile.name || '').toLowerCase() || '.jpg';
    const thumbFileName = `thumbnail${thumbExt}`;
    const thumbAbsolutePath = path.join(exerciseDir, thumbFileName);
    const thumbBuffer = Buffer.from(await input.thumbnailFile.arrayBuffer());
    await fs.writeFile(thumbAbsolutePath, thumbBuffer);
    thumbnailPublicPath = toPublicPath(thumbAbsolutePath);
  }

  const motionFileName = 'keypoints.json';
  const motionAbsolutePath = path.join(exerciseDir, motionFileName);
  await fs.writeFile(motionAbsolutePath, JSON.stringify(input.motionData ?? null, null, 2), 'utf-8');
  const motionPublicPath = toPublicPath(motionAbsolutePath);

  const exercise: StoredExercise = {
    id,
    name: input.name,
    category_id: input.category_id ?? null,
    category_name: null,
    description: input.description ?? '',
    body_part: input.body_part ?? '',
    injury_category: input.injury_category ?? '',
    focus_joints: normalizeList(input.focus_joints),
    steps: normalizeList(input.steps),
    video_url: videoPublicPath,
    motion_data_url: motionPublicPath,
    thumbnail_url: thumbnailPublicPath,
    created_by: input.created_by ?? null,
    created_at,
  };

  const index = await readIndex();
  index.push(exercise);
  await writeIndex(index);

  return exercise;
}

export async function deleteStoredExerciseById(id: string): Promise<boolean> {
  const index = await readIndex();
  const existing = index.find((exercise) => exercise.id === id);
  if (!existing) return false;

  const updated = index.filter((exercise) => exercise.id !== id);
  await writeIndex(updated);

  const dir = path.join(EXERCISE_ROOT, id);
  await fs.rm(dir, { recursive: true, force: true });
  return true;
}
