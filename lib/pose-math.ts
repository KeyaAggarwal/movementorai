import type { Keypoint, JointAngles, PoseComparison, PoseFrame } from '@/types';

// ─── Vector Math ──────────────────────────────────────────────────────────────

function dot(a: [number, number], b: [number, number]): number {
  return a[0] * b[0] + a[1] * b[1];
}

function magnitude(v: [number, number]): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
}

/**
 * Calculate the angle at joint B formed by points A → B → C
 * angle = arccos( (A-B)·(C-B) / (|A-B| * |C-B|) )
 */
export function jointAngle(A: Keypoint, B: Keypoint, C: Keypoint): number {
  const ab: [number, number] = [A.x - B.x, A.y - B.y];
  const cb: [number, number] = [C.x - B.x, C.y - B.y];

  const cosAngle = dot(ab, cb) / (magnitude(ab) * magnitude(cb) + 1e-8);
  const clamped = Math.max(-1, Math.min(1, cosAngle));
  return (Math.acos(clamped) * 180) / Math.PI;
}

// ─── Skeleton Normalization ───────────────────────────────────────────────────

/**
 * Translate skeleton so that the hip midpoint is at the origin,
 * then scale by torso length (hip midpoint → shoulder midpoint distance).
 */
export function normalizeSkeleton(
  joints: Record<string, Keypoint>
): Record<string, Keypoint> {
  const lh = joints['left_hip'];
  const rh = joints['right_hip'];
  const ls = joints['left_shoulder'];
  const rs = joints['right_shoulder'];

  if (!lh || !rh || !ls || !rs) return joints;

  // Hip center = translation anchor
  const cx = (lh.x + rh.x) / 2;
  const cy = (lh.y + rh.y) / 2;

  // Torso length = distance from hip center to shoulder center
  const scx = (ls.x + rs.x) / 2;
  const scy = (ls.y + rs.y) / 2;
  const torsoLength = Math.sqrt((scx - cx) ** 2 + (scy - cy) ** 2) + 1e-8;

  const normalized: Record<string, Keypoint> = {};
  for (const [name, kp] of Object.entries(joints)) {
    normalized[name] = {
      x: (kp.x - cx) / torsoLength,
      y: (kp.y - cy) / torsoLength,
      score: kp.score,
      name: kp.name,
    };
  }
  return normalized;
}

// ─── Angle Extraction ─────────────────────────────────────────────────────────

/**
 * Extract key joint angles from a pose frame's joints map.
 */
export function extractJointAngles(joints: Record<string, Keypoint>): JointAngles {
  const get = (name: string) => joints[name];
  const angles: JointAngles = {};

  // Elbows
  if (get('left_shoulder') && get('left_elbow') && get('left_wrist')) {
    angles.elbow_left = jointAngle(get('left_shoulder'), get('left_elbow'), get('left_wrist'));
  }
  if (get('right_shoulder') && get('right_elbow') && get('right_wrist')) {
    angles.elbow_right = jointAngle(get('right_shoulder'), get('right_elbow'), get('right_wrist'));
  }

  // Shoulders
  if (get('left_hip') && get('left_shoulder') && get('left_elbow')) {
    angles.shoulder_left = jointAngle(get('left_hip'), get('left_shoulder'), get('left_elbow'));
  }
  if (get('right_hip') && get('right_shoulder') && get('right_elbow')) {
    angles.shoulder_right = jointAngle(get('right_hip'), get('right_shoulder'), get('right_elbow'));
  }

  // Knees
  if (get('left_hip') && get('left_knee') && get('left_ankle')) {
    angles.knee_left = jointAngle(get('left_hip'), get('left_knee'), get('left_ankle'));
  }
  if (get('right_hip') && get('right_knee') && get('right_ankle')) {
    angles.knee_right = jointAngle(get('right_hip'), get('right_knee'), get('right_ankle'));
  }

  // Hips
  if (get('left_shoulder') && get('left_hip') && get('left_knee')) {
    angles.hip_left = jointAngle(get('left_shoulder'), get('left_hip'), get('left_knee'));
  }
  if (get('right_shoulder') && get('right_hip') && get('right_knee')) {
    angles.hip_right = jointAngle(get('right_shoulder'), get('right_hip'), get('right_knee'));
  }

  return angles;
}

// ─── Pose Comparison ─────────────────────────────────────────────────────────

const ANGLE_ERROR_THRESHOLD = 12; // degrees

/**
 * Compare patient pose angles vs reference angles.
 * Returns per-joint errors, average error, score, and list of bad joints.
 */
export function comparePoses(
  patientAngles: JointAngles,
  referenceAngles: JointAngles
): PoseComparison {
  const joint_errors: Record<string, number> = {};
  let totalError = 0;
  let count = 0;
  const incorrect_joints: string[] = [];

  for (const [joint, refAngle] of Object.entries(referenceAngles)) {
    if (refAngle === undefined) continue;
    const patAngle = patientAngles[joint];
    if (patAngle === undefined) continue;

    const error = Math.abs(patAngle - refAngle);
    joint_errors[joint] = error;
    totalError += error;
    count++;

    if (error > ANGLE_ERROR_THRESHOLD) {
      incorrect_joints.push(joint);
    }
  }

  const avg_error = count > 0 ? totalError / count : 0;
  const accuracy_score = Math.max(0, Math.round(100 - avg_error));

  return { joint_errors, avg_error, accuracy_score, incorrect_joints };
}

// ─── Step Recognition ─────────────────────────────────────────────────────────

export interface StepDefinition {
  id: number;
  label: string;
  start_frame: number;
  end_frame: number;
}

/**
 * Find which reference step best matches the current patient pose
 * by comparing angle similarity to recorded frames within each step.
 */
export function recognizeStep(
  patientAngles: JointAngles,
  motionFrames: PoseFrame[],
  steps: StepDefinition[],
  focusJoints: string[]
): number {
  let bestStep = 1;
  let bestScore = Infinity;

  for (const step of steps) {
    // Sample a few frames from this step
    const stepFrames = motionFrames.slice(step.start_frame, step.end_frame + 1);
    if (stepFrames.length === 0) continue;

    // Use the midpoint frame as representative
    const midFrame = stepFrames[Math.floor(stepFrames.length / 2)];
    const refAngles = extractJointAngles(midFrame.joints);

    let err = 0;
    let n = 0;
    for (const joint of focusJoints) {
      const ref = refAngles[joint];
      const pat = patientAngles[joint];
      if (ref !== undefined && pat !== undefined) {
        err += Math.abs(pat - ref);
        n++;
      }
    }

    const avgErr = n > 0 ? err / n : Infinity;
    if (avgErr < bestScore) {
      bestScore = avgErr;
      bestStep = step.id;
    }
  }

  return bestStep;
}

// ─── Range of Motion ─────────────────────────────────────────────────────────

export interface ROMTracker {
  minAngle: number;
  maxAngle: number;
  reset: () => void;
  update: (angle: number) => void;
  getROM: () => number;
}

export function createROMTracker(): ROMTracker {
  let minAngle = Infinity;
  let maxAngle = -Infinity;

  return {
    get minAngle() { return minAngle; },
    get maxAngle() { return maxAngle; },
    reset() { minAngle = Infinity; maxAngle = -Infinity; },
    update(angle: number) {
      if (angle < minAngle) minAngle = angle;
      if (angle > maxAngle) maxAngle = angle;
    },
    getROM() {
      return maxAngle === -Infinity ? 0 : maxAngle - minAngle;
    },
  };
}

// ─── Rep State Machine ────────────────────────────────────────────────────────

export class RepStateMachine {
  private currentStep = 1;
  private completedSteps = new Set<number>();
  private totalSteps: number;
  public repCount = 0;

  constructor(totalSteps: number) {
    this.totalSteps = totalSteps;
  }

  update(detectedStep: number): boolean {
    // Mark step as visited
    this.completedSteps.add(detectedStep);
    this.currentStep = detectedStep;

    // A rep is complete when all steps have been visited
    if (this.completedSteps.size >= this.totalSteps) {
      this.repCount++;
      this.completedSteps.clear();
      return true; // rep completed
    }
    return false;
  }

  getCurrentStep() { return this.currentStep; }
  reset() { this.completedSteps.clear(); this.currentStep = 1; this.repCount = 0; }
}
