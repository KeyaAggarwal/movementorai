'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Plus, Trash2, Play, Pause, CheckCircle, Loader2, ChevronRight } from 'lucide-react';
import { extractPoseKeypointsFromVideo, type MediaPipeMotionData } from '@/lib/mediapipe-pose';
import { drawSkeleton } from '@/lib/skeleton-renderer';
import type { Keypoint } from '@/types';

interface Step {
  id: number;
  label: string;
  start_frame: number;
  end_frame: number;
}

type Phase = 'upload' | 'extracting' | 'segment' | 'details' | 'done';

export default function CreateExercise() {
  const [exerciseId, setExerciseId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setExerciseId(params.get('exerciseId'));
  }, []);

  const [phase, setPhase] = useState<Phase>('upload');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [progress, setProgress] = useState(0);
  const [totalFrames, setTotalFrames] = useState(120);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [steps, setSteps] = useState<Step[]>([
    { id: 1, label: 'Start Position', start_frame: 0, end_frame: 25 },
    { id: 2, label: 'Main Movement', start_frame: 26, end_frame: 80 },
    { id: 3, label: 'Return to Neutral', start_frame: 81, end_frame: 120 },
  ]);
  const [form, setForm] = useState({
    name: '', body_part: '', injury_category: '', focus_joints: '', description: '',
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [motionData, setMotionData] = useState<MediaPipeMotionData | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const segmentCanvasRef = useRef<HTMLCanvasElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('video/')) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setMotionData(null);
      setExtractError(null);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setMotionData(null);
      setExtractError(null);
    }
  };

  const startExtraction = async () => {
    if (!videoFile) return;
    setPhase('extracting');
    setProgress(0);
    setExtractError(null);

    try {
      const extracted = await extractPoseKeypointsFromVideo(videoFile, (pct) => setProgress(pct));
      setMotionData(extracted);
      setTotalFrames(extracted.totalFrames);

      const oneThird = Math.max(1, Math.floor(extracted.totalFrames / 3));
      setSteps([
        { id: 1, label: 'Start Position', start_frame: 0, end_frame: oneThird },
        { id: 2, label: 'Main Movement', start_frame: oneThird + 1, end_frame: oneThird * 2 },
        { id: 3, label: 'Return to Neutral', start_frame: oneThird * 2 + 1, end_frame: extracted.totalFrames },
      ]);

      setPhase('segment');
    } catch (err: any) {
      setExtractError(err?.message || 'Pose extraction failed. Try another video.');
      setPhase('upload');
    }
  };

  const addStep = () => {
    const last = steps[steps.length - 1];
    setSteps([...steps, {
      id: steps.length + 1,
      label: `Step ${steps.length + 1}`,
      start_frame: last.end_frame + 1,
      end_frame: Math.min(last.end_frame + 30, totalFrames),
    }]);
  };

  const updateStep = (id: number, field: keyof Step, value: string | number) => {
    setSteps(steps.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeStep = (id: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter(s => s.id !== id));
  };

  const getStepForFrame = (frame: number) =>
    steps.find(s => frame >= s.start_frame && frame <= s.end_frame);

  const currentStep = getStepForFrame(currentFrame);

  useEffect(() => {
    if (!exerciseId) return;
    let mounted = true;

    const loadExercise = async () => {
      try {
        const res = await fetch(`/api/exercises?id=${exerciseId}&include_motion=1`);
        const json = await res.json();
        if (!mounted || !json?.data) return;

        const data = json.data;
        setVideoUrl(data.video_url || '');
        setForm({
          name: data.name || '',
          body_part: data.body_part || '',
          injury_category: data.injury_category || '',
          focus_joints: Array.isArray(data.focus_joints) ? data.focus_joints.join(', ') : '',
          description: data.description || '',
        });

        if (Array.isArray(data.steps) && data.steps.length > 0) {
          setSteps(data.steps);
        }

        if (data.motion_data && Array.isArray(data.motion_data.frames)) {
          setMotionData(data.motion_data as MediaPipeMotionData);
          const inferredTotalFrames = Number(data.motion_data.totalFrames || data.motion_data.frames.length || 120);
          setTotalFrames(inferredTotalFrames);
        }

        setCurrentFrame(0);
        setPhase('segment');
      } catch {
        // Keep default create flow if loading fails.
      }
    };

    loadExercise();
    return () => { mounted = false; };
  }, [exerciseId]);

  const syncFrameFromVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video || !motionData) return;
    const fps = motionData.fps || 30;
    const frameFromTime = Math.round(video.currentTime * fps);
    setCurrentFrame(Math.min(totalFrames, Math.max(0, frameFromTime)));
  }, [motionData, totalFrames]);

  useEffect(() => {
    if (phase !== 'segment') return;
    if (!motionData || motionData.frames.length === 0) return;

    const canvas = segmentCanvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;

    const width = video?.clientWidth ?? canvas.parentElement?.clientWidth ?? 640;
    const height = video?.clientHeight ?? Math.round((width * 9) / 16);
    canvas.width = width;
    canvas.height = height;

    const frame = motionData.frames.reduce((closest, current) => {
      return Math.abs(current.frame - currentFrame) < Math.abs(closest.frame - currentFrame)
        ? current
        : closest;
    }, motionData.frames[0]);

    const joints: Record<string, Keypoint> = {};
    for (const point of frame.keypoints) {
      joints[point.name] = {
        x: point.x,
        y: point.y,
        score: point.visibility,
        name: point.name,
      };
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawSkeleton(ctx, joints, canvas.width, canvas.height, {
      color: '#63CAB7',
      lineWidth: 2,
      dotRadius: 3,
      alpha: 0.95,
      minConfidence: 0.2,
    });
  }, [phase, motionData, currentFrame]);

  useEffect(() => {
    if (phase !== 'segment') return;
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => setIsPlaying(false);
    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);

    video.addEventListener('ended', handleEnded);
    video.addEventListener('pause', handlePause);
    video.addEventListener('play', handlePlay);

    return () => {
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('play', handlePlay);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'segment' || !isPlaying) return;
    let raf = 0;

    const tick = () => {
      syncFrameFromVideo();
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, isPlaying, syncFrameFromVideo]);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setSaveError('Exercise name is required.');
      return;
    }

    if (!motionData || motionData.frames.length === 0) {
      setSaveError('Please run pose extraction first.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      if (!videoFile) {
        throw new Error('Please upload a video file before saving.');
      }

      const createThumbnailFile = async (file: File): Promise<File | null> => {
        return new Promise((resolve) => {
          const preview = document.createElement('video');
          const objectUrl = URL.createObjectURL(file);
          preview.src = objectUrl;
          preview.muted = true;
          preview.playsInline = true;
          preview.preload = 'metadata';

          const cleanup = () => {
            URL.revokeObjectURL(objectUrl);
            preview.src = '';
          };

          const finalizeFromCurrentFrame = () => {
            const canvas = document.createElement('canvas');
            canvas.width = preview.videoWidth || 640;
            canvas.height = preview.videoHeight || 360;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              cleanup();
              resolve(null);
              return;
            }

            ctx.drawImage(preview, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
              cleanup();
              if (!blob) {
                resolve(null);
                return;
              }
              resolve(new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' }));
            }, 'image/jpeg', 0.9);
          };

          preview.onloadedmetadata = () => {
            const duration = Number.isFinite(preview.duration) ? preview.duration : 0;
            const targetTime = duration > 0.2 ? Math.min(duration * 0.2, duration - 0.1) : 0;

            const onSeeked = () => {
              preview.removeEventListener('seeked', onSeeked);
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  finalizeFromCurrentFrame();
                });
              });
            };

            preview.addEventListener('seeked', onSeeked, { once: true });

            try {
              preview.currentTime = targetTime;
            } catch {
              preview.removeEventListener('seeked', onSeeked);
              finalizeFromCurrentFrame();
            }
          };

          preview.onerror = () => {
            cleanup();
            resolve(null);
          };
        });
      };

      const thumbnailFile = await createThumbnailFile(videoFile);

      const formData = new FormData();
      formData.append('name', form.name.trim());
      formData.append('body_part', form.body_part);
      formData.append('injury_category', form.injury_category);
      formData.append('description', form.description);
      formData.append('category_id', '');
      formData.append('focus_joints', JSON.stringify(
        form.focus_joints
          .split(',')
          .map((joint) => joint.trim())
          .filter(Boolean)
      ));
      formData.append('steps', JSON.stringify(steps));
      formData.append('motion_data', JSON.stringify(motionData));
      formData.append('created_by', '');
      formData.append('video_file', videoFile);
      if (thumbnailFile) {
        formData.append('thumbnail_file', thumbnailFile);
      }

      const res = await fetch('/api/exercises', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || json?.error) {
        throw new Error(json?.error || 'Failed to save exercise');
      }

      setPhase('done');
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save exercise');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl">
      {/* Progress steps */}
      <div className="flex items-center gap-3 mb-8">
        {(['upload', 'extracting', 'segment', 'details'] as Phase[]).map((p, i) => {
          const labels = ['Upload Video', 'Extract Poses', 'Segment Steps', 'Exercise Details'];
          const phaseOrder = ['upload', 'extracting', 'segment', 'details', 'done'];
          const current = phaseOrder.indexOf(phase);
          const thisIdx = phaseOrder.indexOf(p);
          const done = current > thisIdx;
          const active = current === thisIdx;

          return (
            <div key={p} className="flex items-center gap-3">
              <div className={`flex items-center gap-2 text-sm ${active ? 'text-teal-300' : done ? 'text-teal-500' : 'text-teal-800'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono border transition-colors
                  ${active ? 'border-teal-300 bg-teal-300/10 text-teal-300' : done ? 'border-teal-600 bg-teal-600/10 text-teal-600' : 'border-teal-800 text-teal-800'}`}>
                  {done ? '✓' : i + 1}
                </div>
                {labels[i]}
              </div>
              {i < 3 && <ChevronRight className="w-3.5 h-3.5 text-teal-800" />}
            </div>
          );
        })}
      </div>

      {/* Phase: Upload */}
      {phase === 'upload' && (
        <div className="animate-fade-in">
          <h1 className="font-display text-3xl text-teal-50 mb-2">Upload Exercise Video</h1>
          <p className="text-teal-600 text-sm mb-8">Upload a video of yourself performing the exercise. We'll extract the skeleton motion automatically.</p>

          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-teal-300/20 rounded-2xl p-12 text-center hover:border-teal-300/40 transition-colors cursor-pointer mb-6"
            onClick={() => document.getElementById('video-input')?.click()}
          >
            {videoUrl ? (
              <div>
                <video ref={videoRef} src={videoUrl} className="max-h-48 mx-auto rounded-xl mb-4" controls />
                <p className="text-teal-400 text-sm">{videoFile?.name}</p>
              </div>
            ) : (
              <div>
                <Upload className="w-10 h-10 text-teal-700 mx-auto mb-4" />
                <p className="text-teal-400 text-sm mb-2">Drop video here or click to browse</p>
                <p className="text-teal-700 text-xs">MP4, MOV, WebM · max 200MB</p>
              </div>
            )}
            <input id="video-input" type="file" accept="video/*" onChange={handleFileInput} className="hidden" />
          </div>

          <button onClick={startExtraction} disabled={!videoFile}
            className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <Play className="w-4 h-4" />
            Extract Poses with MediaPipe
          </button>
          {extractError && <p className="text-xs text-red-400 mt-3">{extractError}</p>}
        </div>
      )}

      {/* Phase: Extracting */}
      {phase === 'extracting' && (
        <div className="animate-fade-in text-center py-16">
          <Loader2 className="w-12 h-12 text-teal-300 mx-auto mb-6 animate-spin" />
          <h2 className="font-display text-2xl text-teal-50 mb-3">Extracting Poses</h2>
          <p className="text-teal-600 text-sm mb-8">Running MediaPipe Pose Landmarker on the video…</p>
          <div className="max-w-xs mx-auto">
            <div className="flex justify-between text-xs font-mono text-teal-600 mb-2">
              <span>Progress</span><span>{progress}%</span>
            </div>
            <div className="h-2 bg-teal-300/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-teal-700 to-teal-300 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }} />
            </div>
            <p className="text-teal-700 text-xs mt-3">Processing frame {Math.round((progress / 100) * totalFrames)}/{totalFrames}</p>
          </div>
        </div>
      )}

      {/* Phase: Segment */}
      {phase === 'segment' && (
        <div className="animate-fade-in">
          <h1 className="font-display text-3xl text-teal-50 mb-2">Segment Exercise Steps</h1>
          <p className="text-teal-600 text-sm mb-8">Define the steps of the exercise by setting frame ranges. Scrub the video to find the right frames.</p>

          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Video scrubber */}
            <div className="card">
              <div className="label mb-3">Video Preview</div>
              {videoUrl ? (
                <div className="relative mb-3">
                  <video src={videoUrl} className="w-full rounded-xl" ref={videoRef} />
                  <canvas
                    ref={segmentCanvasRef}
                    className="absolute inset-0 w-full h-full rounded-xl pointer-events-none"
                  />
                </div>
              ) : (
                <div className="w-full h-40 bg-teal-300/5 rounded-xl flex items-center justify-center mb-3">
                  <span className="text-teal-700 text-sm font-mono">video preview</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <button onClick={() => { setIsPlaying(!isPlaying); isPlaying ? videoRef.current?.pause() : videoRef.current?.play(); }}
                  className="w-8 h-8 rounded-lg bg-teal-300/10 flex items-center justify-center">
                  {isPlaying ? <Pause className="w-3.5 h-3.5 text-teal-300" /> : <Play className="w-3.5 h-3.5 text-teal-300" />}
                </button>
                <input type="range" min={0} max={Math.max(1, totalFrames)} value={currentFrame}
                  onChange={e => {
                    const frame = Number(e.target.value);
                    setCurrentFrame(frame);
                    if (videoRef.current && motionData) {
                      const fps = motionData.fps || 30;
                      videoRef.current.currentTime = frame / fps;
                    }
                  }}
                  className="flex-1 accent-teal-300" />
                <span className="text-xs font-mono text-teal-500 w-16 text-right">
                  {currentFrame}/{totalFrames}
                </span>
              </div>
              {currentStep && (
                <div className="mt-3 text-xs font-mono text-teal-400 bg-teal-300/5 rounded-lg px-3 py-2">
                  → {currentStep.label}
                </div>
              )}
              <p className="text-teal-700 text-[11px] mt-2">Skeleton overlay uses extracted MediaPipe keypoints for the selected frame.</p>
            </div>

            {/* Timeline visualization */}
            <div className="card">
              <div className="label mb-3">Frame Timeline</div>
              <div className="h-10 bg-teal-300/5 rounded-lg overflow-hidden flex mb-4 relative">
                {steps.map((s, i) => {
                  const colors = ['bg-teal-500/40', 'bg-teal-400/40', 'bg-teal-300/40'];
                  const w = ((s.end_frame - s.start_frame) / totalFrames) * 100;
                  const l = (s.start_frame / totalFrames) * 100;
                  return (
                    <div key={s.id} className={`absolute top-0 bottom-0 ${colors[i % 3]} flex items-center justify-center text-[10px] font-mono text-teal-200 border-r border-teal-950`}
                      style={{ left: `${l}%`, width: `${w}%` }}>
                      {s.id}
                    </div>
                  );
                })}
                {/* Playhead */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-white/60"
                  style={{ left: `${(currentFrame / totalFrames) * 100}%` }} />
              </div>
              <p className="text-teal-700 text-xs">Total: {totalFrames} frames · {steps.length} steps</p>
            </div>
          </div>

          {/* Steps editor */}
          <div className="card mb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="label">Exercise Steps</div>
              <button onClick={addStep} className="text-xs text-teal-400 flex items-center gap-1 hover:text-teal-300 transition-colors">
                <Plus className="w-3 h-3" /> Add Step
              </button>
            </div>
            <div className="space-y-3">
              {steps.map((step, i) => (
                <div key={step.id} className="flex items-center gap-3 p-3 bg-teal-300/5 rounded-xl border border-teal-300/10">
                  <div className="w-7 h-7 rounded-full bg-teal-300/15 flex items-center justify-center text-xs font-mono text-teal-300 flex-shrink-0">
                    {step.id}
                  </div>
                  <input value={step.label} onChange={e => updateStep(step.id, 'label', e.target.value)}
                    className="flex-1 bg-transparent text-teal-100 text-sm outline-none placeholder:text-teal-700"
                    placeholder="Step label" />
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-teal-700">frames</span>
                    <input type="number" value={step.start_frame} min={0} max={totalFrames}
                      onChange={e => updateStep(step.id, 'start_frame', Number(e.target.value))}
                      className="w-14 bg-teal-300/5 border border-teal-300/10 rounded-lg px-2 py-1 text-teal-300 font-mono text-center outline-none" />
                    <span className="text-teal-700">→</span>
                    <input type="number" value={step.end_frame} min={0} max={totalFrames}
                      onChange={e => updateStep(step.id, 'end_frame', Number(e.target.value))}
                      className="w-14 bg-teal-300/5 border border-teal-300/10 rounded-lg px-2 py-1 text-teal-300 font-mono text-center outline-none" />
                  </div>
                  <button onClick={() => removeStep(step.id)} className="text-teal-800 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => setPhase('details')} className="btn-primary w-full flex items-center justify-center gap-2">
            Continue to Exercise Details
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Phase: Details */}
      {phase === 'details' && (
        <div className="animate-fade-in">
          <h1 className="font-display text-3xl text-teal-50 mb-2">Exercise Details</h1>
          <p className="text-teal-600 text-sm mb-8">Fill in metadata to help organize this exercise in the library.</p>

          <div className="card space-y-5">
            <div>
              <label className="label block mb-2">Exercise Name</label>
              <input className="input" placeholder="e.g. Wrist Rotation Rehab"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label block mb-2">Body Part</label>
                <select className="input" value={form.body_part} onChange={e => setForm({ ...form, body_part: e.target.value })}>
                  <option value="">Select…</option>
                  <option>Arm</option><option>Leg</option><option>Back</option><option>Core</option>
                </select>
              </div>
              <div>
                <label className="label block mb-2">Injury Category</label>
                <input className="input" placeholder="e.g. Elbow Injury"
                  value={form.injury_category} onChange={e => setForm({ ...form, injury_category: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label block mb-2">Focus Joints (comma-separated)</label>
              <input className="input" placeholder="e.g. wrist, elbow"
                value={form.focus_joints} onChange={e => setForm({ ...form, focus_joints: e.target.value })} />
            </div>
            <div>
              <label className="label block mb-2">Description</label>
              <textarea className="input min-h-24 resize-none" placeholder="Describe the exercise and its rehab purpose…"
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>

            <div className="pt-2 border-t border-teal-300/10">
              <div className="label mb-3">Step Summary</div>
              {steps.map(s => (
                <div key={s.id} className="flex items-center gap-3 text-sm mb-2">
                  <span className="text-teal-500 font-mono w-6">{s.id}.</span>
                  <span className="text-teal-200">{s.label}</span>
                  <span className="ml-auto text-teal-700 font-mono text-xs">frames {s.start_frame}–{s.end_frame}</span>
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleSubmit} className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {isSaving ? 'Saving…' : 'Save Exercise to Library'}
          </button>
          {saveError && <p className="text-xs text-red-400 mt-3">{saveError}</p>}
        </div>
      )}

      {/* Phase: Done */}
      {phase === 'done' && (
        <div className="animate-fade-in text-center py-20">
          <div className="w-16 h-16 rounded-full bg-teal-300/15 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-teal-300" />
          </div>
          <h2 className="font-display text-3xl text-teal-50 mb-3">{form.name || 'Exercise'} Saved</h2>
          <p className="text-teal-600 text-sm mb-8 max-w-sm mx-auto">
            Motion data extracted, steps segmented, and exercise added to your library.
          </p>
          <div className="flex gap-3 justify-center">
            <a href="/therapist/patients" className="btn-primary">Assign to Patient</a>
            <a href="/therapist" className="btn-ghost">Back to Library</a>
          </div>
        </div>
      )}
    </div>
  );
}
