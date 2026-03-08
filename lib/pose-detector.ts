'use client';

import type { Keypoint } from '@/types';

// Dynamically imported to avoid SSR issues
let poseDetection: any = null;
let detector: any = null;
let isLoading = false;

export interface DetectionResult {
  joints: Record<string, Keypoint>;
  score: number;
}

const JOINT_NAMES = [
  'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
  'left_shoulder', 'right_shoulder',
  'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist',
  'left_hip', 'right_hip',
  'left_knee', 'right_knee',
  'left_ankle', 'right_ankle',
];

/**
 * Initialize MoveNet detector. Call once on mount.
 */
export async function initDetector(): Promise<void> {
  if (detector || isLoading) return;
  isLoading = true;

  try {
    // Dynamic imports to avoid SSR
    const tf = await import('@tensorflow/tfjs');
    await import('@tensorflow/tfjs-backend-webgl');
    await tf.ready();

    poseDetection = await import('@tensorflow-models/pose-detection');

    detector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        enableSmoothing: true,
        minPoseScore: 0.25,
      }
    );
    console.log('[PhysioAI] MoveNet detector initialized');
  } catch (err) {
    console.error('[PhysioAI] Failed to initialize MoveNet:', err);
    throw err;
  } finally {
    isLoading = false;
  }
}

/**
 * Run pose detection on a video or canvas element.
 * Returns joints keyed by name, or null if no pose found.
 */
export async function detectPose(
  source: HTMLVideoElement | HTMLCanvasElement
): Promise<DetectionResult | null> {
  if (!detector) return null;

  try {
    const poses = await detector.estimatePoses(source);
    if (!poses || poses.length === 0) return null;

    const pose = poses[0];
    const joints: Record<string, Keypoint> = {};
    let totalScore = 0;

    pose.keypoints.forEach((kp: any, i: number) => {
      const name = JOINT_NAMES[i];
      joints[name] = {
        x: kp.x,
        y: kp.y,
        score: kp.score ?? 0,
        name,
      };
      totalScore += kp.score ?? 0;
    });

    return {
      joints,
      score: totalScore / pose.keypoints.length,
    };
  } catch (err) {
    console.error('[PhysioAI] Pose detection error:', err);
    return null;
  }
}

/**
 * Dispose the detector to free GPU memory.
 */
export function disposeDetector(): void {
  if (detector) {
    detector.dispose?.();
    detector = null;
  }
}

/**
 * Extract pose data from a video file by sampling frames.
 * Used in the therapist exercise creation flow.
 */
export async function extractMotionFromVideo(
  videoFile: File,
  onProgress?: (pct: number) => void
): Promise<{ frames: any[]; fps: number; totalFrames: number }> {
  await initDetector();

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.src = URL.createObjectURL(videoFile);

    video.onloadedmetadata = async () => {
      const fps = 30;
      const duration = video.duration;
      const totalFrames = Math.floor(duration * fps);
      const frames: any[] = [];

      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;

      // Sample every 2nd frame to keep data size manageable
      const sampleRate = 2;
      let frameIdx = 0;

      const processNextFrame = () => {
        const time = (frameIdx * sampleRate) / fps;
        if (time >= duration) {
          URL.revokeObjectURL(video.src);
          resolve({ frames, fps, totalFrames: frames.length });
          return;
        }

        video.currentTime = time;
        onProgress?.(Math.round((frameIdx * sampleRate / totalFrames) * 100));
        frameIdx++;
      };

      video.onseeked = async () => {
        ctx.drawImage(video, 0, 0, 256, 256);
        const result = await detectPose(canvas);

        if (result) {
          frames.push({
            frame: frameIdx,
            timestamp_ms: video.currentTime * 1000,
            joints: result.joints,
          });
        }

        processNextFrame();
      };

      processNextFrame();
    };

    video.onerror = reject;
  });
}
