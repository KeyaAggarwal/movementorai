'use client';

import type { Keypoint } from '@/types';
import { SKELETON_CONNECTIONS } from '@/types';

export interface SkeletonDrawOptions {
  color?: string;
  lineWidth?: number;
  dotRadius?: number;
  alpha?: number;
  highlightJoints?: string[];
  highlightColor?: string;
  minConfidence?: number;
}

const DEFAULTS: Required<SkeletonDrawOptions> = {
  color: '#63CAB7',
  lineWidth: 2.5,
  dotRadius: 4,
  alpha: 1,
  highlightJoints: [],
  highlightColor: '#ff4d4d',
  minConfidence: 0.3,
};

/**
 * Draw a skeleton on a 2D canvas context.
 * Coordinates are in pixel space matching the canvas dimensions.
 */
export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  joints: Record<string, Keypoint>,
  canvasWidth: number,
  canvasHeight: number,
  options: SkeletonDrawOptions = {}
): void {
  const opts = { ...DEFAULTS, ...options };
  ctx.save();
  ctx.globalAlpha = opts.alpha;

  // Draw connections
  for (const [nameA, nameB] of SKELETON_CONNECTIONS) {
    const a = joints[nameA];
    const b = joints[nameB];
    if (!a || !b) continue;
    if ((a.score ?? 1) < opts.minConfidence) continue;
    if ((b.score ?? 1) < opts.minConfidence) continue;

    const isHighlighted = opts.highlightJoints.includes(nameA) || opts.highlightJoints.includes(nameB);
    const color = isHighlighted ? opts.highlightColor : opts.color;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = opts.lineWidth;
    ctx.lineCap = 'round';

    if (isHighlighted) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    } else {
      ctx.shadowBlur = 0;
    }

    ctx.moveTo(a.x * canvasWidth, a.y * canvasHeight);
    ctx.lineTo(b.x * canvasWidth, b.y * canvasHeight);
    ctx.stroke();
  }

  // Draw joint dots
  for (const [name, kp] of Object.entries(joints)) {
    if ((kp.score ?? 1) < opts.minConfidence) continue;

    const isHighlighted = opts.highlightJoints.includes(name);
    const color = isHighlighted ? opts.highlightColor : opts.color;

    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = isHighlighted ? 10 : 4;

    ctx.arc(kp.x * canvasWidth, kp.y * canvasHeight, opts.dotRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draw both patient (solid) and ghost (translucent) skeletons.
 */
export function drawDualSkeleton(
  ctx: CanvasRenderingContext2D,
  patientJoints: Record<string, Keypoint>,
  ghostJoints: Record<string, Keypoint>,
  canvasWidth: number,
  canvasHeight: number,
  incorrectJoints: string[] = []
): void {
  // Ghost skeleton first (behind)
  drawSkeleton(ctx, ghostJoints, canvasWidth, canvasHeight, {
    color: 'rgba(99, 202, 183, 0.35)',
    lineWidth: 1.5,
    dotRadius: 3,
    alpha: 0.6,
    highlightJoints: [],
  });

  // Patient skeleton on top (solid)
  drawSkeleton(ctx, patientJoints, canvasWidth, canvasHeight, {
    color: '#63CAB7',
    lineWidth: 2.5,
    dotRadius: 4.5,
    alpha: 1,
    highlightJoints: incorrectJoints,
    highlightColor: '#ff4d4d',
  });
}

/**
 * Scale normalized [0,1] coordinates to pixel space.
 * Handles the offset needed when the video is letterboxed in the canvas.
 */
export function videoToCanvasCoords(
  joints: Record<string, Keypoint>,
  videoWidth: number,
  videoHeight: number,
  canvasWidth: number,
  canvasHeight: number
): Record<string, Keypoint> {
  // Compute letterbox offsets
  const videoAspect = videoWidth / videoHeight;
  const canvasAspect = canvasWidth / canvasHeight;

  let scaleX: number, scaleY: number, offsetX: number, offsetY: number;

  if (videoAspect > canvasAspect) {
    scaleX = canvasWidth / videoWidth;
    scaleY = scaleX;
    offsetX = 0;
    offsetY = (canvasHeight - videoHeight * scaleY) / 2;
  } else {
    scaleY = canvasHeight / videoHeight;
    scaleX = scaleY;
    offsetX = (canvasWidth - videoWidth * scaleX) / 2;
    offsetY = 0;
  }

  const result: Record<string, Keypoint> = {};
  for (const [name, kp] of Object.entries(joints)) {
    result[name] = {
      x: (kp.x * scaleX + offsetX) / canvasWidth,
      y: (kp.y * scaleY + offsetY) / canvasHeight,
      score: kp.score,
      name: kp.name,
    };
  }
  return result;
}
