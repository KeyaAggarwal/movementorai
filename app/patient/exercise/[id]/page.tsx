'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Square, Volume2, VolumeX, CheckCircle, AlertTriangle } from 'lucide-react';
import { initDetector, detectPose } from '@/lib/pose-detector';
import { drawDualSkeleton, videoToCanvasCoords } from '@/lib/skeleton-renderer';
import { normalizeSkeleton, extractJointAngles, comparePoses, RepStateMachine, createROMTracker } from '@/lib/pose-math';
import { formatDuration } from '@/lib/utils';
import type { Keypoint, PoseFrame } from '@/types';

// ─── Mock exercise data (production: fetched from Supabase) ──────────────────
const EXERCISE = {
  id: '1',
  name: 'Wrist Rotation Rehab',
  focus_joints: ['right_elbow', 'right_wrist'],
  sets_per_day: 3,
  reps_per_set: 10,
  steps: [
    { id: 1, label: 'Start Position', description: 'Hold arm at side, elbow bent 90°' },
    { id: 2, label: 'Rotate Wrist Outward', description: 'Rotate wrist away from body 60–90°' },
    { id: 3, label: 'Return to Neutral', description: 'Slowly return to starting position' },
  ],
};

// ─── Mock ghost skeleton frames (production: loaded from exercise_motion.json) ─
function generateGhostFrames(totalFrames = 120): PoseFrame[] {
  return Array.from({ length: totalFrames }, (_, i) => {
    const t = i / totalFrames;
    const wristRotation = Math.sin(t * Math.PI * 2) * 0.15;
    return {
      frame: i,
      timestamp_ms: (i / 30) * 1000,
      joints: {
        nose: { x: 0.5, y: 0.12 },
        left_eye: { x: 0.46, y: 0.10 },
        right_eye: { x: 0.54, y: 0.10 },
        left_ear: { x: 0.42, y: 0.11 },
        right_ear: { x: 0.58, y: 0.11 },
        left_shoulder: { x: 0.37, y: 0.28 },
        right_shoulder: { x: 0.63, y: 0.28 },
        left_elbow: { x: 0.28, y: 0.44 },
        right_elbow: { x: 0.72, y: 0.44 },
        left_wrist: { x: 0.22, y: 0.58 },
        right_wrist: { x: 0.78 + wristRotation, y: 0.58 - wristRotation * 0.5 },
        left_hip: { x: 0.42, y: 0.60 },
        right_hip: { x: 0.58, y: 0.60 },
        left_knee: { x: 0.40, y: 0.76 },
        right_knee: { x: 0.60, y: 0.76 },
        left_ankle: { x: 0.39, y: 0.92 },
        right_ankle: { x: 0.61, y: 0.92 },
      },
    };
  });
}

const GHOST_FRAMES = generateGhostFrames();

type ExerciseData = {
  id: string;
  name: string;
  focus_joints: string[];
  sets_per_day: number;
  reps_per_set: number;
  steps: { id: number; label: string; description?: string }[];
};

function mapMotionToPoseFrames(motion: any): PoseFrame[] {
  if (!motion || !Array.isArray(motion.frames)) return [];
  return motion.frames.map((frame: any, idx: number) => {
    const joints: Record<string, Keypoint> = {};
    const keypoints = Array.isArray(frame.keypoints) ? frame.keypoints : [];
    for (const point of keypoints) {
      if (!point?.name) continue;
      joints[point.name] = {
        x: point.x,
        y: point.y,
        score: point.visibility ?? 1,
        name: point.name,
      };
    }
    return {
      frame: Number(frame.frame ?? idx),
      timestamp_ms: Number(frame.timestamp_ms ?? 0),
      joints,
    };
  });
}

function mirrorJoints(joints: Record<string, Keypoint>): Record<string, Keypoint> {
  const mirrored: Record<string, Keypoint> = {};
  for (const [name, joint] of Object.entries(joints)) {
    mirrored[name] = {
      ...joint,
      x: 1 - joint.x,
    };
  }
  return mirrored;
}

function getAlignmentHint(
  patientJoints: Record<string, Keypoint>,
  ghostJoints: Record<string, Keypoint>
): string {
  const centerOf = (joints: Record<string, Keypoint>) => {
    const ls = joints.left_shoulder;
    const rs = joints.right_shoulder;
    const lh = joints.left_hip;
    const rh = joints.right_hip;
    const anchors = [ls, rs, lh, rh].filter(Boolean) as Keypoint[];
    if (anchors.length === 0) {
      const all = Object.values(joints);
      if (all.length === 0) return null;
      const x = all.reduce((sum, item) => sum + item.x, 0) / all.length;
      const y = all.reduce((sum, item) => sum + item.y, 0) / all.length;
      return { x, y };
    }
    const x = anchors.reduce((sum, item) => sum + item.x, 0) / anchors.length;
    const y = anchors.reduce((sum, item) => sum + item.y, 0) / anchors.length;
    return { x, y };
  };

  const patientCenter = centerOf(patientJoints);
  const ghostCenter = centerOf(ghostJoints);
  if (!patientCenter || !ghostCenter) return 'Step fully into frame and face the camera.';

  const hints: string[] = [];
  const dx = ghostCenter.x - patientCenter.x;
  const dy = ghostCenter.y - patientCenter.y;

  if (dx > 0.04) hints.push('move right');
  else if (dx < -0.04) hints.push('move left');

  if (dy > 0.05) hints.push('move down');
  else if (dy < -0.05) hints.push('move up');

  const shoulderDist = (joints: Record<string, Keypoint>) => {
    const ls = joints.left_shoulder;
    const rs = joints.right_shoulder;
    if (!ls || !rs) return null;
    return Math.hypot(ls.x - rs.x, ls.y - rs.y);
  };

  const patientScale = shoulderDist(patientJoints);
  const ghostScale = shoulderDist(ghostJoints);
  if (patientScale && ghostScale) {
    if (patientScale < ghostScale * 0.78) hints.push('move closer to camera');
    else if (patientScale > ghostScale * 1.28) hints.push('step slightly back');
  }

  if (hints.length === 0) return 'Fine tune your joints to match the guide outline.';
  return `Try to ${hints.join(' and ')}.`;
}

// ─── Accuracy Ring SVG ───────────────────────────────────────────────────────
function AccuracyRing({ score }: { score: number }) {
  const r = 32, circ = 2 * Math.PI * r;
  const dash = (Math.min(100, score) / 100) * circ;
  const color = score >= 80 ? '#63CAB7' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(99,202,183,0.1)" strokeWidth="5" />
      <circle cx="44" cy="44" r={r} fill="none"
        stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ / 4}
        style={{ transition: 'stroke-dasharray 0.5s ease', filter: `drop-shadow(0 0 4px ${color})` }}
      />
      <text x="44" y="48" textAnchor="middle"
        fill="#e8f5f2" fontSize="17" fontFamily="var(--font-dm-mono)" fontWeight="500">
        {score}
      </text>
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LiveExercise({ params }: { params: { id: string } }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const idleRafRef = useRef<number>(0);
  const alignmentUpdateRef = useRef<number>(0);
  const repMachineRef = useRef(new RepStateMachine(EXERCISE.steps.length));
  const romTrackerRef = useRef(createROMTracker());
  const ghostFrameRef = useRef(0);
  const accuracyBufferRef = useRef<number[]>([]);

  const [detectorReady, setDetectorReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [sessionState, setSessionState] = useState<'idle' | 'active' | 'paused' | 'done'>('idle');
  const [repCount, setRepCount] = useState(0);
  const [setCount, setSetCount] = useState(1);
  const [currentStep, setCurrentStep] = useState(1);
  const [accuracyScore, setAccuracyScore] = useState(100);
  const [incorrectJoints, setIncorrectJoints] = useState<string[]>([]);
  const [rom, setRom] = useState({ current: 0, max: 0 });
  const [feedback, setFeedback] = useState({ message: 'Press Start when ready', severity: 'good' as 'good' | 'warn' | 'error' });
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [isAlignedToGuide, setIsAlignedToGuide] = useState(false);
  const [alignmentScore, setAlignmentScore] = useState(0);
  const [alignCountdown, setAlignCountdown] = useState<number | null>(null);
  const [exercise, setExercise] = useState<ExerciseData>(EXERCISE);
  const [ghostFrames, setGhostFrames] = useState<PoseFrame[]>(GHOST_FRAMES);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadExercise = async () => {
      try {
        const res = await fetch(`/api/exercises?id=${params.id}&include_motion=1`);
        const json = await res.json();
        if (!mounted || !json?.data) return;

        const data = json.data;
        setExercise({
          id: data.id,
          name: data.name,
          focus_joints: Array.isArray(data.focus_joints) ? data.focus_joints : [],
          sets_per_day: 3,
          reps_per_set: 10,
          steps: Array.isArray(data.steps) ? data.steps : EXERCISE.steps,
        });

        const mappedFrames = mapMotionToPoseFrames(data.motion_data);
        if (mappedFrames.length > 0) {
          setGhostFrames(mappedFrames);
        }
      } catch {
        setExercise(EXERCISE);
        setGhostFrames(GHOST_FRAMES);
      }
    };

    loadExercise();
    return () => { mounted = false; };
  }, [params.id]);

  useEffect(() => {
    repMachineRef.current = new RepStateMachine(Math.max(1, exercise.steps.length));
  }, [exercise.steps.length]);

  // ── Init detector + camera ────────────────────────────────────────────────
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function init() {
      try {
        await initDetector();
        setDetectorReady(true);
      } catch (e) {
        console.error('MoveNet init failed:', e);
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch (e) {
        console.error('Camera access failed:', e);
      }
    }

    init();

    return () => {
      stream?.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(idleRafRef.current);
    };
  }, []);

  useEffect(() => {
    if (sessionState !== 'idle' || !cameraReady || !detectorReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    const loop = async () => {
      if (sessionState !== 'idle') return;

      const activeGhostFrames = ghostFrames.length > 0 ? ghostFrames : GHOST_FRAMES;
      const ghostFrame = activeGhostFrames[0];

      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, W, H);
      ctx.restore();

      const result = await detectPose(video);
      const now = performance.now();

      if (result) {
        const patientJoints = videoToCanvasCoords(result.joints, video.videoWidth || 640, video.videoHeight || 480, W, H);
        const ghostJoints = ghostFrame.joints;
        const mirroredPatientJoints = mirrorJoints(patientJoints);
        const mirroredGhostJoints = mirrorJoints(ghostJoints);

        const normPatient = normalizeSkeleton(mirroredPatientJoints);
        const normGhost = normalizeSkeleton(mirroredGhostJoints);
        const patAngles = extractJointAngles(normPatient);
        const refAngles = extractJointAngles(normGhost);
        const comparison = comparePoses(patAngles, refAngles);

        drawDualSkeleton(ctx, mirroredPatientJoints, mirroredGhostJoints, W, H, comparison.incorrect_joints);

        const aligned = comparison.accuracy_score >= 82 && comparison.incorrect_joints.length <= 1;
        if (now - alignmentUpdateRef.current > 180) {
          alignmentUpdateRef.current = now;
          setAlignmentScore(comparison.accuracy_score);
          setIsAlignedToGuide(aligned);
          if (aligned) {
            setFeedback({ message: 'Aligned with guide skeleton. You can start now.', severity: 'good' });
          } else {
            const hint = getAlignmentHint(mirroredPatientJoints, mirroredGhostJoints);
            setFeedback({ message: `Align with guide: ${hint}`, severity: 'warn' });
          }
        }
      } else {
        drawDualSkeleton(ctx, {}, mirrorJoints(ghostFrame.joints), W, H, []);
        if (now - alignmentUpdateRef.current > 180) {
          alignmentUpdateRef.current = now;
          setAlignmentScore(0);
          setIsAlignedToGuide(false);
          setFeedback({ message: 'Step into view and align with the ghost skeleton.', severity: 'warn' });
        }
      }

      idleRafRef.current = requestAnimationFrame(loop);
    };

    idleRafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(idleRafRef.current);
  }, [sessionState, cameraReady, detectorReady, ghostFrames]);

  useEffect(() => {
    if (sessionState !== 'idle' || !isAlignedToGuide) {
      setAlignCountdown(null);
      return;
    }

    setAlignCountdown(3);
    const interval = setInterval(() => {
      setAlignCountdown((current) => {
        if (current === null) return null;
        if (current <= 1) {
          setSessionState('active');
          setFeedback({ message: 'Session started — follow the ghost skeleton!', severity: 'good' });
          return null;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionState, isAlignedToGuide]);

  // ── Main detection loop ───────────────────────────────────────────────────
  const runDetectionLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;

    const loop = async () => {
      if (sessionState !== 'active') return;

      ctx.clearRect(0, 0, W, H);

      // Draw mirrored camera frame
      ctx.save();
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, W, H);
      ctx.restore();

      // Get ghost frame (cycles through motion data)
      const activeGhostFrames = ghostFrames.length > 0 ? ghostFrames : GHOST_FRAMES;
      const ghostFrame = activeGhostFrames[ghostFrameRef.current % activeGhostFrames.length];
      ghostFrameRef.current += 1;

      // Detect patient pose
      const result = await detectPose(video);

      if (result) {
        // Scale to canvas
        const patientJoints = videoToCanvasCoords(result.joints, video.videoWidth || 640, video.videoHeight || 480, W, H);
        const ghostJoints = ghostFrame.joints;
        const mirroredPatientJoints = mirrorJoints(patientJoints);
        const mirroredGhostJoints = mirrorJoints(ghostJoints);

        // Normalize both for comparison
        const normPatient = normalizeSkeleton(mirroredPatientJoints);
        const normGhost = normalizeSkeleton(mirroredGhostJoints);

        // Compute angles + compare
        const patAngles = extractJointAngles(normPatient);
        const refAngles = extractJointAngles(normGhost);
        const comparison = comparePoses(patAngles, refAngles);

        // Map incorrect joint names back to skeleton parts for highlighting
        const highlightJoints = comparison.incorrect_joints
          .flatMap(j => [j.replace('elbow_', 'right_elbow').replace('wrist_', 'right_wrist')]);

        // Draw dual skeleton
        drawDualSkeleton(ctx, mirroredPatientJoints, mirroredGhostJoints, W, H, comparison.incorrect_joints);

        // Update accuracy (rolling average)
        accuracyBufferRef.current.push(comparison.accuracy_score);
        if (accuracyBufferRef.current.length > 30) accuracyBufferRef.current.shift();
        const avgScore = Math.round(accuracyBufferRef.current.reduce((a, b) => a + b, 0) / accuracyBufferRef.current.length);

        // ROM tracking (use right elbow angle if available)
        const elbowAngle = patAngles.elbow_right ?? patAngles.elbow_left;
        if (elbowAngle !== undefined) {
          romTrackerRef.current.update(elbowAngle);
          setRom({ current: Math.round(elbowAngle), max: Math.round(romTrackerRef.current.getROM()) });
        }

        // Step detection (simplified: use ghost frame position as proxy)
        const frameProgress = ghostFrameRef.current % activeGhostFrames.length;
        const normalized = frameProgress / Math.max(1, activeGhostFrames.length);
        const stepCount = Math.max(1, exercise.steps.length);
        const newStep = Math.min(stepCount, Math.floor(normalized * stepCount) + 1);

        // Rep machine
        const repDone = repMachineRef.current.update(newStep);
        if (repDone) {
          const newReps = repMachineRef.current.repCount;
          setRepCount(newReps);
          if (newReps >= exercise.reps_per_set) {
            handleSetComplete();
          }
        }

        // Update state
        setCurrentStep(newStep);
        setAccuracyScore(avgScore);
        setIncorrectJoints(comparison.incorrect_joints);

        // Feedback
        if (comparison.incorrect_joints.length === 0) {
          setFeedback({ message: 'Great form! Keep it up.', severity: 'good' });
        } else {
          const j = comparison.incorrect_joints[0].replace('_', ' ');
          setFeedback({
            message: avgScore < 70
              ? `Adjust your ${j} — try to match the guide skeleton.`
              : `Almost there — slight correction needed at ${j}.`,
            severity: avgScore < 70 ? 'error' : 'warn',
          });
        }
      } else {
        // No pose found
        ctx.save();
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, W, H);
        ctx.restore();

        // Still draw ghost
        drawDualSkeleton(ctx, {}, mirrorJoints(ghostFrame.joints), W, H, []);
        setFeedback({ message: 'Position yourself in front of the camera.', severity: 'warn' });
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [sessionState, ghostFrames, exercise.steps.length, exercise.reps_per_set]);

  useEffect(() => {
    if (sessionState === 'active') {
      runDetectionLoop();
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionState, runDetectionLoop]);

  const handleSetComplete = () => {
    if (setCount >= exercise.sets_per_day) {
      setSessionState('done');
      setSessionComplete(true);
    } else {
      setSetCount(s => s + 1);
      setRepCount(0);
      repMachineRef.current.reset();
      romTrackerRef.current.reset();
      setFeedback({ message: `Set complete! Rest, then continue set ${setCount + 1}.`, severity: 'good' });
    }
  };

  const handleStart = () => {
    if (!isAlignedToGuide) {
      setFeedback({ message: 'Align to the ghost skeleton before starting.', severity: 'warn' });
      return;
    }
    setSessionState('active');
    setFeedback({ message: 'Session started — follow the ghost skeleton!', severity: 'good' });
  };

  const handlePause = () => {
    setSessionState(s => s === 'active' ? 'paused' : 'active');
  };

  const handleStop = () => {
    setSessionState('done');
    setSessionComplete(true);
  };

  // ─── UI ────────────────────────────────────────────────────────────────────
  if (sessionComplete) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="card max-w-md w-full text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-teal-300/15 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-teal-300" />
          </div>
          <h2 className="font-display text-2xl text-teal-50 mb-2">Session Complete!</h2>
          <p className="text-teal-600 text-sm mb-8">Great work. Here's your session summary.</p>
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { label: 'Accuracy', value: `${accuracyScore}%` },
              { label: 'Max ROM', value: `${rom.max}°` },
              { label: 'Duration', value: formatDuration(elapsed) },
            ].map(({ label, value }) => (
              <div key={label} className="card-sm text-center">
                <div className="label mb-1">{label}</div>
                <div className="text-teal-300 font-mono text-xl">{value}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <a href="/patient" className="btn-primary flex-1">Back to Exercises</a>
            <a href="/patient/history" className="btn-ghost flex-1">View History</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="label mb-1">{exercise.steps.length} steps · {exercise.reps_per_set} reps/set</div>
          <h1 className="font-display text-2xl text-teal-50">{exercise.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs font-mono text-teal-600">{formatDuration(elapsed)}</div>
          <button onClick={() => setMuted(m => !m)} className="w-8 h-8 rounded-lg bg-teal-300/5 flex items-center justify-center text-teal-600 hover:text-teal-400 transition-colors">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono
            ${sessionState === 'active' ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-teal-300/10 border border-teal-300/20 text-teal-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sessionState === 'active' ? 'bg-red-500 animate-pulse' : 'bg-teal-400'}`} />
            {sessionState === 'active' ? 'LIVE' : sessionState === 'paused' ? 'PAUSED' : 'READY'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-5">
        {/* Left: camera + skeleton */}
        <div>
          {/* Camera feed */}
          <div className="relative rounded-2xl overflow-hidden bg-black border border-teal-300/10 mb-4" style={{ aspectRatio: '4/3' }}>
            {/* Hidden video element (source for detection) */}
            <video ref={videoRef} muted playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none" />

            {/* Canvas (shows mirrored video + skeletons) */}
            <canvas ref={canvasRef} width={640} height={480}
              className="absolute inset-0 w-full h-full object-cover" />

            {/* Scanlines */}
            <div className="absolute inset-0 scanlines pointer-events-none opacity-30" />

            {/* Status overlay when idle */}
            {sessionState === 'idle' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
                <div className="bg-black/70 border border-teal-300/30 rounded-xl px-4 py-3 mb-4 text-center">
                  <div className="text-teal-300 text-2xl font-mono font-semibold leading-none mb-1">
                    {alignmentScore}%
                  </div>
                  <div className="text-teal-400 text-sm font-mono">
                    Alignment
                  </div>
                </div>
                <div className="text-teal-300 text-sm mb-4 font-mono bg-black/60 border border-teal-300/20 rounded-lg px-3 py-1.5">
                  {!cameraReady ? '⏳ Requesting camera access…' :
                   !detectorReady ? '⏳ Loading MoveNet model…' :
                   isAlignedToGuide
                     ? `✓ Aligned (${alignmentScore}%) · Auto start in ${alignCountdown ?? 3}s`
                     : `Align with guide (${alignmentScore}%)`}
                </div>
                {cameraReady && detectorReady && (
                  <button onClick={handleStart} disabled={!isAlignedToGuide} className="btn-primary flex items-center gap-2 text-base px-8 py-3 disabled:opacity-40 disabled:cursor-not-allowed">
                    <Play className="w-5 h-5" />
                    Start Session
                  </button>
                )}
              </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-3 left-3 flex gap-4">
              {[
                { color: '#63CAB7', label: 'Your skeleton' },
                { color: 'rgba(167,139,250,0.7)', label: 'Guide' },
                { color: '#ff4d4d', label: 'Correction needed' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="text-[10px] font-mono text-teal-400">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Feedback bar */}
          <div className={`flex items-center gap-3 p-3.5 rounded-xl border text-sm transition-all duration-300
            ${feedback.severity === 'good' ? 'bg-teal-300/5 border-teal-300/15 text-teal-300' :
              feedback.severity === 'warn' ? 'bg-yellow-500/5 border-yellow-500/15 text-yellow-400' :
              'bg-red-500/5 border-red-500/15 text-red-400'}`}>
            {feedback.severity === 'good'
              ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
              : <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            }
            {feedback.message}
          </div>

          {/* Controls */}
          <div className="flex gap-3 mt-4">
            {sessionState === 'idle' ? (
              <button onClick={handleStart} disabled={!cameraReady || !detectorReady || !isAlignedToGuide}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed py-3">
                <Play className="w-4 h-4" />
                {!detectorReady ? 'Loading MoveNet…' : !cameraReady ? 'Waiting for camera…' : !isAlignedToGuide ? 'Align to Start' : 'Start Session'}
              </button>
            ) : (
              <>
                <button onClick={handlePause} className="btn-ghost flex-1 flex items-center justify-center gap-2 py-3">
                  {sessionState === 'active' ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Resume</>}
                </button>
                <button onClick={handleStop} className="btn-ghost flex items-center gap-2 py-3 px-4 text-red-400 border-red-500/20 hover:border-red-500/40">
                  <Square className="w-4 h-4" />
                  End
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-4">
          {/* Steps */}
          <div className="card">
            <div className="label mb-3">Exercise Steps</div>
            <div className="space-y-2">
              {exercise.steps.map(step => {
                const active = currentStep === step.id && sessionState === 'active';
                const done = sessionState === 'active' && currentStep > step.id;
                return (
                  <div key={step.id} className={`step-item ${active ? 'step-item-active' : 'step-item-inactive'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono flex-shrink-0 transition-colors
                      ${active ? 'bg-teal-300 text-teal-950 font-bold' : done ? 'bg-teal-600/30 text-teal-400' : 'bg-teal-300/10 text-teal-700'}`}>
                      {done ? '✓' : step.id}
                    </div>
                    <div className="min-w-0">
                      <div className={`text-sm ${active ? 'text-teal-100 font-medium' : 'text-teal-600'}`}>{step.label}</div>
                      {active && <div className="text-xs text-teal-600 mt-0.5 truncate">{step.description}</div>}
                    </div>
                    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-300 animate-pulse flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reps + Sets */}
          <div className="card">
            <div className="label mb-3">Progress</div>
            <div className="flex justify-between mb-3">
              <div className="text-center">
                <div className="text-4xl font-mono text-teal-50 font-medium">{repCount}</div>
                <div className="text-xs text-teal-600 mt-1">of {exercise.reps_per_set} reps</div>
              </div>
              <div className="w-px bg-teal-300/10" />
              <div className="text-center">
                <div className="text-4xl font-mono text-teal-50 font-medium">{setCount}</div>
                <div className="text-xs text-teal-600 mt-1">of {exercise.sets_per_day} sets</div>
              </div>
            </div>
            <div className="h-1.5 bg-teal-300/10 rounded-full overflow-hidden">
              <div className="h-full bg-teal-300/60 rounded-full transition-all"
                style={{ width: `${(repCount / Math.max(1, exercise.reps_per_set)) * 100}%` }} />
            </div>
          </div>

          {/* Accuracy */}
          <div className="card">
            <div className="label mb-3">Accuracy</div>
            <div className="flex items-center gap-4">
              <AccuracyRing score={accuracyScore} />
              <div className="flex-1 space-y-2">
                {incorrectJoints.length > 0
                  ? incorrectJoints.slice(0, 3).map(j => (
                    <div key={j} className="flex items-center gap-2 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                      <span className="text-red-400 font-mono">{j.replace('_', ' ')}</span>
                    </div>
                  ))
                  : <div className="text-xs text-teal-400 font-mono">All joints correct ✓</div>
                }
              </div>
            </div>
          </div>

          {/* ROM */}
          <div className="card">
            <div className="label mb-3">Range of Motion</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Current', value: `${rom.current}°` },
                { label: 'Max ROM', value: `${rom.max}°` },
                { label: 'Target', value: '80°' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-lg font-mono text-teal-300">{value}</div>
                  <div className="text-[10px] text-teal-700 mt-1">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
