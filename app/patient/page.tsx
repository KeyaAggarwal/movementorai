'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Play, Clock, Target, CheckCircle, Flame, Trophy } from 'lucide-react';
import { SARAH_PATIENT_ID } from '@/lib/demo-constants';

type Assignment = {
  id: string;
  patient_id: string;
  exercise_id: string;
  sets_per_day: number;
  reps_per_set: number;
  duration_days: number;
  is_active: number;
};

type Exercise = {
  id: string;
  name: string;
  injury_category?: string;
  focus_joints?: string[];
};

type AssignedExerciseCard = {
  id: string;
  assignment_id: string;
  name: string;
  injury_category: string;
  sets_per_day: number;
  reps_per_set: number;
  completed_today: number;
  focus_joints: string[];
  accuracy_last: number;
  rom_last: number;
};

export default function PatientHome() {
  const [cards, setCards] = useState<AssignedExerciseCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadAssignedExercises = async () => {
      try {
        const [assignmentsRes, exercisesRes] = await Promise.all([
          fetch(`/api/assignments?patient_id=${SARAH_PATIENT_ID}`),
          fetch('/api/exercises'),
        ]);

        const assignmentsJson = await assignmentsRes.json();
        const exercisesJson = await exercisesRes.json();

        if (!mounted) return;

        const assignments: Assignment[] = Array.isArray(assignmentsJson?.data) ? assignmentsJson.data : [];
        const exercises: Exercise[] = Array.isArray(exercisesJson?.data) ? exercisesJson.data : [];

        const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));

        const mapped: AssignedExerciseCard[] = assignments.map((assignment) => {
          const exercise = exerciseById.get(assignment.exercise_id);
          return {
            id: assignment.exercise_id,
            assignment_id: assignment.id,
            name: exercise?.name ?? 'Assigned Exercise',
            injury_category: exercise?.injury_category ?? 'Rehab Exercise',
            sets_per_day: assignment.sets_per_day,
            reps_per_set: assignment.reps_per_set,
            completed_today: 0,
            focus_joints: exercise?.focus_joints ?? [],
            accuracy_last: 0,
            rom_last: 0,
          };
        });

        setCards(mapped);
      } catch {
        if (!mounted) return;
        setCards([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadAssignedExercises();
    return () => { mounted = false; };
  }, []);

  const completedCount = useMemo(
    () => cards.filter((exercise) => exercise.completed_today >= exercise.sets_per_day).length,
    [cards]
  );

  const streakDays = 9;
  const romGained = 18;
  const goalRom = 80;
  const currentWeek = 3;
  const targetWeek = 6;
  const recoveryProgress = Math.max(0, Math.min(100, (currentWeek / targetWeek) * 100));

  return (
    <div>
      <div className="mb-8">
        <div className="text-xs font-mono text-teal-600 tracking-widest uppercase mb-2">Good morning, Sarah</div>
        <h1 className="font-display text-3xl font-semibold text-teal-50 mb-2">Today's Exercises</h1>
        <p className="text-teal-600 text-sm">
          {completedCount} of {cards.length} exercises complete
        </p>

        <div className="mt-4 flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-teal-300/20 bg-teal-300/10 text-xs font-mono text-teal-300">
            <Flame className="w-3.5 h-3.5" />
            {streakDays}-day streak
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-teal-300/20 bg-teal-300/10 text-xs font-mono text-teal-300">
            <Trophy className="w-3.5 h-3.5" />
            {completedCount}/{cards.length} goals today
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card text-teal-600 text-sm">Loading assigned exercises…</div>
      ) : cards.length === 0 ? (
        <div className="card text-teal-600 text-sm">No exercises assigned yet.</div>
      ) : (
        <div className="space-y-4">
          {cards.map((ex) => {
            const done = ex.completed_today >= ex.sets_per_day;
            const remaining = ex.sets_per_day - ex.completed_today;

            return (
              <div key={ex.assignment_id} className={`card transition-all duration-200 ${done ? 'opacity-60' : 'hover:border-teal-300/25'}`}>
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-teal-300/10">
                    {done
                      ? <CheckCircle className="w-5 h-5 text-teal-400" />
                      : <Target className="w-5 h-5 text-teal-300" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-teal-600 font-mono mb-1">{ex.injury_category}</div>
                    <div className="text-teal-100 font-medium text-base">{ex.name}</div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-teal-600 text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {remaining > 0 ? `${remaining} set${remaining > 1 ? 's' : ''} remaining` : 'All sets done'}
                      </span>
                      <span className="text-teal-600 text-xs">{ex.reps_per_set} reps/set</span>
                      {ex.focus_joints.length > 0 && (
                        <span className="text-xs font-mono text-teal-500">{ex.focus_joints.join(' · ')}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-6 text-center">
                    <div>
                      <div className="label mb-1">Last Accuracy</div>
                      <div className="text-sm font-mono text-teal-50">{ex.accuracy_last}%</div>
                    </div>
                    <div>
                      <div className="label mb-1">Last ROM</div>
                      <div className="text-sm font-mono text-teal-50">{ex.rom_last}°</div>
                    </div>
                    <div>
                      <div className="label mb-1">Progress</div>
                      <div className="text-sm font-mono text-teal-50">{ex.completed_today}/{ex.sets_per_day}</div>
                    </div>
                  </div>

                  <div className="ml-4">
                    {done ? (
                      <div className="text-xs text-teal-600 font-mono">Complete ✓</div>
                    ) : (
                      <Link href={`/patient/exercise/${ex.id}`}
                        className="btn-primary flex items-center gap-2 whitespace-nowrap">
                        <Play className="w-4 h-4" />
                        Start Exercise
                      </Link>
                    )}
                  </div>
                </div>

                <div className="mt-4 h-1 bg-teal-300/10 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-300/60 rounded-full transition-all"
                    style={{ width: `${(ex.completed_today / ex.sets_per_day) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card mt-8 border-teal-300/20">
        <div className="label mb-1">Recovery Dashboard</div>
        <h2 className="text-teal-100 font-medium mb-4">Current Progress</h2>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card-sm text-center bg-teal-300/5 border border-teal-300/10">
            <div className="label mb-1">Current Streak</div>
            <div className="text-2xl font-mono text-teal-50">{streakDays} days</div>
          </div>
          <div className="card-sm text-center bg-teal-300/5 border border-teal-300/10">
            <div className="label mb-1">ROM Gained</div>
            <div className="text-2xl font-mono text-teal-50">+{romGained}°</div>
          </div>
          <div className="card-sm text-center bg-teal-300/5 border border-teal-300/10">
            <div className="label mb-1">Goal ROM</div>
            <div className="text-2xl font-mono text-teal-50">{goalRom}°</div>
          </div>
        </div>

        <div className="rounded-xl border border-teal-300/10 bg-teal-300/5 p-4">
          <div className="flex items-center justify-between text-xs font-mono text-teal-600 mb-2">
            <span>Recovery Timeline</span>
            <span>Week {currentWeek} of {targetWeek}</span>
          </div>

          <div className="relative h-2 rounded-full bg-teal-300/10 overflow-hidden mb-3">
            <div
              className="h-full bg-teal-300 rounded-full"
              style={{ width: `${recoveryProgress}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-teal-50 border border-teal-900"
              style={{ left: `calc(${recoveryProgress}% - 6px)` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-teal-400 font-mono">Week 3: Current</span>
            <span className="text-teal-50 font-mono">Week 6: Playing Tennis</span>
          </div>
        </div>
      </div>
    </div>
  );
}
