 'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Play, Users, ChevronRight } from 'lucide-react';
import type { ExerciseStep } from '@/types';

type Exercise = {
  id: string;
  name: string;
  category_id: string | null;
  description: string;
  body_part: string;
  injury_category: string;
  focus_joints: string[];
  video_url: string;
  motion_data_url: string;
  thumbnail_url?: string;
  steps: ExerciseStep[];
  created_by: string | null;
  created_at: string;
};

const CATEGORIES = [
  { id: 'all', label: 'All Exercises' },
  { id: 'arm', label: 'Arm' },
  { id: 'leg', label: 'Leg' },
  { id: 'shoulder', label: 'Shoulder' },
];

function ExerciseCard({ exercise }: { exercise: Exercise }) {
  return (
    <div className="card group hover:border-teal-300/25 transition-all duration-300">
      {/* Video thumbnail */}
      <div className="w-full h-32 rounded-xl bg-teal-300/5 border border-teal-300/10 flex items-center justify-center mb-4 relative overflow-hidden">
        {exercise.thumbnail_url ? (
          <img
            src={exercise.thumbnail_url}
            alt={`${exercise.name} thumbnail`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : exercise.video_url ? (
          <video
            src={exercise.video_url}
            className="absolute inset-0 w-full h-full object-cover"
            muted
            playsInline
            autoPlay
            loop
            preload="metadata"
          />
        ) : (
          <div className="text-teal-800 text-xs font-mono uppercase tracking-wider">
            {exercise.body_part} · {exercise.focus_joints.join(' · ')}
          </div>
        )}
        <div className="absolute inset-0 bg-grid opacity-50" />
      </div>

      <div className="label mb-1">{exercise.injury_category}</div>
      <h3 className="text-teal-100 font-medium text-base mb-2">{exercise.name}</h3>
      <p className="text-teal-600 text-sm leading-relaxed mb-4 line-clamp-2">{exercise.description}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {exercise.focus_joints.map(j => (
            <span key={j} className="text-[10px] font-mono text-teal-500 bg-teal-300/5 border border-teal-300/10 px-2 py-0.5 rounded-full">
              {j}
            </span>
          ))}
        </div>
        <div className="text-[10px] font-mono text-teal-700">
          {exercise.steps.length} steps
        </div>
      </div>

      <div className="flex gap-2 mt-4 pt-4 border-t border-teal-300/10">
        <Link
          href={`/therapist/patients?assign=${exercise.id}`}
          className="flex-1 btn-ghost text-center text-xs flex items-center justify-center gap-1.5"
        >
          <Users className="w-3 h-3" />
          Assign
        </Link>
        <Link
          href={`/therapist/create?exerciseId=${exercise.id}`}
          className="flex-1 btn-primary text-center text-xs flex items-center justify-center gap-1.5"
        >
          <Play className="w-3 h-3" />
          Preview
        </Link>
      </div>
    </div>
  );
}

export default function TherapistLibrary() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadExercises = async () => {
      try {
        const res = await fetch('/api/exercises');
        const json = await res.json();
        if (!mounted) return;
        setExercises(Array.isArray(json?.data) ? json.data : []);
      } catch {
        if (!mounted) return;
        setExercises([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadExercises();
    return () => { mounted = false; };
  }, []);

  const exerciseCount = useMemo(() => exercises.length, [exercises]);

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold text-teal-50 mb-2">Exercise Library</h1>
          <p className="text-teal-600 text-sm">
            {exerciseCount} exercises · organized by body part and injury type
          </p>
        </div>
        <Link href="/therapist/create" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Exercise
        </Link>
      </div>

      {/* Hierarchy breadcrumb */}
      <div className="card-sm mb-6 flex items-center gap-2 text-sm">
        <span className="text-teal-400">Body</span>
        <ChevronRight className="w-3.5 h-3.5 text-teal-700" />
        <span className="text-teal-400">Arm</span>
        <ChevronRight className="w-3.5 h-3.5 text-teal-700" />
        <span className="text-teal-300">Elbow Injury</span>
        <div className="ml-auto flex gap-2">
          {CATEGORIES.map(c => (
            <button key={c.id} className={`text-xs px-3 py-1 rounded-lg transition-colors ${c.id === 'all' ? 'bg-teal-300/10 text-teal-300' : 'text-teal-600 hover:text-teal-400'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Exercise grid */}
      {isLoading ? (
        <div className="card-sm text-teal-600 text-sm">Loading exercises…</div>
      ) : exercises.length === 0 ? (
        <div className="card-sm text-teal-600 text-sm">No exercises yet. Create one to get started.</div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {exercises.map(ex => (
            <ExerciseCard key={ex.id} exercise={ex} />
          ))}
        </div>
      )}
    </div>
  );
}
