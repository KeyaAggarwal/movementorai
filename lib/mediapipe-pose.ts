'use client';

export interface MediaPipeKeypoint {
  name: string;
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface MediaPipePoseFrame {
  frame: number;
  timestamp_ms: number;
  keypoints: MediaPipeKeypoint[];
}

export interface MediaPipeMotionData {
  fps: number;
  totalFrames: number;
  frames: MediaPipePoseFrame[];
}

const LANDMARK_NAMES = [
  'nose',
  'left_eye_inner',
  'left_eye',
  'left_eye_outer',
  'right_eye_inner',
  'right_eye',
  'right_eye_outer',
  'left_ear',
  'right_ear',
  'mouth_left',
  'mouth_right',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_pinky',
  'right_pinky',
  'left_index',
  'right_index',
  'left_thumb',
  'right_thumb',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
  'left_heel',
  'right_heel',
  'left_foot_index',
  'right_foot_index',
] as const;

let poseLandmarker: any = null;

async function getPoseLandmarker() {
  if (poseLandmarker) return poseLandmarker;

  const vision = await import('@mediapipe/tasks-vision');
  const filesetResolver = await vision.FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  );

  poseLandmarker = await vision.PoseLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numPoses: 1,
  });

  return poseLandmarker;
}

export async function extractPoseKeypointsFromVideo(
  videoFile: File,
  onProgress?: (pct: number) => void
): Promise<MediaPipeMotionData> {
  const detector = await getPoseLandmarker();

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = URL.createObjectURL(videoFile);

    video.onloadedmetadata = async () => {
      const fps = 30;
      const durationSec = video.duration || 0;
      const estimatedFrameCount = Math.max(1, Math.floor(durationSec * fps));
      const sampleEvery = 2;
      const frames: MediaPipePoseFrame[] = [];

      let sampleIndex = 0;

      const processNext = () => {
        const frameIndex = sampleIndex * sampleEvery;
        const timestampMs = (frameIndex / fps) * 1000;

        if (timestampMs > durationSec * 1000) {
          URL.revokeObjectURL(video.src);
          onProgress?.(100);
          resolve({
            fps,
            totalFrames: estimatedFrameCount,
            frames,
          });
          return;
        }

        video.currentTime = timestampMs / 1000;
        sampleIndex += 1;
      };

      video.onseeked = async () => {
        try {
          const nowMs = video.currentTime * 1000;
          const result = detector.detectForVideo(video, nowMs);

          if (result?.landmarks?.[0]) {
            const landmarks = result.landmarks[0];
            const keypoints: MediaPipeKeypoint[] = landmarks.map((landmark: any, idx: number) => ({
              name: LANDMARK_NAMES[idx] ?? `landmark_${idx}`,
              x: landmark.x,
              y: landmark.y,
              z: landmark.z ?? 0,
              visibility: landmark.visibility ?? 0,
            }));

            frames.push({
              frame: Math.round((video.currentTime || 0) * fps),
              timestamp_ms: nowMs,
              keypoints,
            });
          }

          const pct = Math.min(100, Math.round((video.currentTime / Math.max(durationSec, 0.001)) * 100));
          onProgress?.(pct);
          processNext();
        } catch (err) {
          URL.revokeObjectURL(video.src);
          reject(err);
        }
      };

      processNext();
    };

    video.onerror = (err) => {
      URL.revokeObjectURL(video.src);
      reject(err);
    };
  });
}
