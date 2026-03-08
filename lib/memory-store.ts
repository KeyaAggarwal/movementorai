import { uid } from '@/lib/db';

type NewExerciseInput = {
  name: string;
  category_id?: string | null;
  description?: string;
  body_part?: string;
  injury_category?: string;
  focus_joints?: string[];
  steps?: any[];
  video_url?: string;
  motion_data_url?: string;
  motion_data?: {
    fps: number;
    totalFrames: number;
    frames: any[];
  } | null;
  thumbnail_url?: string;
  created_by?: string | null;
};

type NewPatientInput = {
  full_name: string;
  email: string;
  injury_notes?: string;
  therapist_id?: string | null;
};

type NewAssignmentInput = {
  patient_id: string;
  exercise_id: string;
  sets_per_day?: number;
  reps_per_set?: number;
  duration_days?: number;
};

export type InMemoryExercise = {
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
  motion_data: {
    fps: number;
    totalFrames: number;
    frames: any[];
  } | null;
  thumbnail_url: string;
  created_by: string | null;
  created_at: string;
};

export type InMemoryPatient = {
  id: string;
  user_id: string;
  therapist_id: string | null;
  injury_notes: string;
  created_at: string;
  email: string;
  full_name: string;
};

export type InMemoryAssignment = {
  id: string;
  patient_id: string;
  exercise_id: string;
  sets_per_day: number;
  reps_per_set: number;
  duration_days: number;
  start_date: string;
  end_date: string;
  is_active: number;
  created_at: string;
};

const EXERCISES: InMemoryExercise[] = [];
const PATIENTS: InMemoryPatient[] = [];
const ASSIGNMENTS: InMemoryAssignment[] = [];

export function listExercises(categoryId?: string | null): InMemoryExercise[] {
  if (!categoryId) return [...EXERCISES].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return EXERCISES
    .filter((exercise) => exercise.category_id === categoryId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function addExercise(input: NewExerciseInput): InMemoryExercise {
  const exercise: InMemoryExercise = {
    id: uid(),
    name: input.name,
    category_id: input.category_id ?? null,
    category_name: null,
    description: input.description ?? '',
    body_part: input.body_part ?? '',
    injury_category: input.injury_category ?? '',
    focus_joints: input.focus_joints ?? [],
    steps: input.steps ?? [],
    video_url: input.video_url ?? '',
    motion_data_url: input.motion_data_url ?? '',
    motion_data: input.motion_data ?? null,
    thumbnail_url: input.thumbnail_url ?? '',
    created_by: input.created_by ?? null,
    created_at: new Date().toISOString(),
  };

  EXERCISES.push(exercise);
  return exercise;
}

export function deleteExerciseById(id: string): boolean {
  const index = EXERCISES.findIndex((exercise) => exercise.id === id);
  if (index === -1) return false;
  EXERCISES.splice(index, 1);
  return true;
}

export function listPatients(therapistId?: string | null): InMemoryPatient[] {
  if (!therapistId) return [...PATIENTS].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return PATIENTS
    .filter((patient) => patient.therapist_id === therapistId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function addPatient(input: NewPatientInput): InMemoryPatient {
  const patient: InMemoryPatient = {
    id: uid(),
    user_id: uid(),
    therapist_id: input.therapist_id ?? null,
    injury_notes: input.injury_notes ?? '',
    created_at: new Date().toISOString(),
    email: input.email,
    full_name: input.full_name,
  };

  PATIENTS.push(patient);
  return patient;
}

export function listAssignments(patientId: string): InMemoryAssignment[] {
  return ASSIGNMENTS
    .filter((assignment) => assignment.patient_id === patientId && assignment.is_active === 1)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function addAssignment(input: NewAssignmentInput): InMemoryAssignment {
  const durationDays = input.duration_days ?? 14;
  const start = new Date();
  const end = new Date(start.getTime() + durationDays * 86400000);

  const assignment: InMemoryAssignment = {
    id: uid(),
    patient_id: input.patient_id,
    exercise_id: input.exercise_id,
    sets_per_day: input.sets_per_day ?? 3,
    reps_per_set: input.reps_per_set ?? 10,
    duration_days: durationDays,
    start_date: start.toISOString(),
    end_date: end.toISOString(),
    is_active: 1,
    created_at: new Date().toISOString(),
  };

  ASSIGNMENTS.push(assignment);
  return assignment;
}

export function deactivateAssignment(id: string): boolean {
  const assignment = ASSIGNMENTS.find((row) => row.id === id);
  if (!assignment) return false;
  assignment.is_active = 0;
  return true;
}
