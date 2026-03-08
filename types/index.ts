// ─── Database Models ─────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  role: 'therapist' | 'patient';
  full_name: string;
  created_at: string;
}

export interface Therapist {
  id: string;
  user_id: string;
  license_number?: string;
  specialization?: string;
}

export interface Patient {
  id: string;
  user_id: string;
  therapist_id: string;
  date_of_birth?: string;
  injury_notes?: string;
}

export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  children?: Category[];
}

export interface ExerciseStep {
  id: number;
  start_frame: number;
  end_frame: number;
  label: string;
  description?: string;
}

export interface Exercise {
  id: string;
  name: string;
  category_id: string;
  category?: Category;
  description: string;
  body_part: string;
  injury_category: string;
  focus_joints: string[];
  video_url: string;
  motion_data_url: string;
  steps: ExerciseStep[];
  thumbnail_url?: string;
  created_by: string;
  created_at: string;
}

export interface PatientAssignment {
  id: string;
  patient_id: string;
  exercise_id: string;
  exercise?: Exercise;
  sets_per_day: number;
  reps_per_set: number;
  duration_days: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export interface ExerciseSession {
  id: string;
  patient_id: string;
  assignment_id: string;
  exercise_id: string;
  timestamp: string;
  duration_seconds: number;
  reps_completed: number;
  sets_completed: number;
  accuracy_score: number;
  avg_rom: number;
  max_rom: number;
  joint_errors: Record<string, number>;
}

// ─── Pose / Motion Types ─────────────────────────────────────────────────────

export interface Keypoint {
  x: number;
  y: number;
  score?: number;
  name?: string;
}

export interface PoseFrame {
  frame: number;
  timestamp_ms: number;
  joints: Record<string, Keypoint>;
}

export interface MotionData {
  exercise_id: string;
  fps: number;
  total_frames: number;
  frames: PoseFrame[];
}

export interface JointAngles {
  elbow_left?: number;
  elbow_right?: number;
  shoulder_left?: number;
  shoulder_right?: number;
  knee_left?: number;
  knee_right?: number;
  hip_left?: number;
  hip_right?: number;
  wrist_left?: number;
  wrist_right?: number;
  [key: string]: number | undefined;
}

export interface PoseComparison {
  joint_errors: Record<string, number>;
  avg_error: number;
  accuracy_score: number;
  incorrect_joints: string[];
}

// ─── Session State ────────────────────────────────────────────────────────────

export type RepState = 'idle' | 'in_progress' | 'complete';
export type SessionState = 'idle' | 'active' | 'paused' | 'complete';

export interface LiveSessionState {
  session_state: SessionState;
  current_step: number;
  rep_count: number;
  set_count: number;
  current_rom: number;
  max_rom: number;
  min_rom: number;
  accuracy_score: number;
  feedback_message: string;
  incorrect_joints: string[];
  rep_state: RepState;
  elapsed_seconds: number;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface WeeklyProgress {
  week: number;
  week_label: string;
  avg_rom: number;
  avg_accuracy: number;
  sessions_completed: number;
  reps_total: number;
}

export interface ComplianceData {
  date: string;
  assigned_sets: number;
  completed_sets: number;
  compliance_rate: number;
}

export interface PatientAnalytics {
  patient_id: string;
  exercise_id: string;
  total_sessions: number;
  compliance_rate: number;
  avg_accuracy: number;
  initial_rom: number;
  latest_rom: number;
  rom_improvement: number;
  weekly_progress: WeeklyProgress[];
  compliance_history: ComplianceData[];
}

// ─── MoveNet Joint Names ──────────────────────────────────────────────────────

export const MOVENET_JOINTS = [
  'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
  'left_shoulder', 'right_shoulder',
  'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist',
  'left_hip', 'right_hip',
  'left_knee', 'right_knee',
  'left_ankle', 'right_ankle',
] as const;

export type JointName = typeof MOVENET_JOINTS[number];

export const SKELETON_CONNECTIONS: [JointName, JointName][] = [
  ['nose', 'left_eye'], ['nose', 'right_eye'],
  ['left_eye', 'left_ear'], ['right_eye', 'right_ear'],
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'], ['right_knee', 'right_ankle'],
];

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}
