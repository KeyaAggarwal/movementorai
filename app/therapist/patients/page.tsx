'use client';

import { useEffect, useState } from 'react';
import { Plus, UserPlus, ClipboardList, CheckCircle, X } from 'lucide-react';

const MOCK_PATIENTS = [
  { id: 'p1', name: 'Sarah Chen', injury: 'Elbow Injury', assigned: 2, compliance: 87, lastSession: '2 hours ago' },
  { id: 'p2', name: 'Marcus Williams', injury: 'Knee Injury', assigned: 1, compliance: 72, lastSession: 'Yesterday' },
  { id: 'p3', name: 'Emma Rodriguez', injury: 'Shoulder Injury', assigned: 3, compliance: 94, lastSession: '1 hour ago' },
  { id: 'p4', name: 'James Park', injury: 'Lower Back', assigned: 2, compliance: 60, lastSession: '3 days ago' },
];

type ExerciseOption = {
  id: string;
  name: string;
  body_part?: string;
};

function ComplianceBadge({ rate }: { rate: number }) {
  const color = rate >= 80 ? 'text-teal-300' : rate >= 60 ? 'text-yellow-400' : 'text-red-400';
  return <span className={`text-sm font-mono font-medium ${color}`}>{rate}%</span>;
}

export default function PatientsPage() {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [exercisesLoading, setExercisesLoading] = useState(true);
  const [assignForm, setAssignForm] = useState({
    exercise_id: '', sets_per_day: 3, reps_per_set: 10, duration_days: 14,
  });
  const [assigned, setAssigned] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

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
        if (mounted) setExercisesLoading(false);
      }
    };

    loadExercises();
    return () => { mounted = false; };
  }, []);

  const handleAssign = async () => {
    if (!selectedPatient || !assignForm.exercise_id) return;

    setIsAssigning(true);
    setAssignError(null);

    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: selectedPatient,
          exercise_id: assignForm.exercise_id,
          sets_per_day: assignForm.sets_per_day,
          reps_per_set: assignForm.reps_per_set,
          duration_days: assignForm.duration_days,
        }),
      });

      const json = await res.json();
      if (!res.ok || json?.error) {
        throw new Error(json?.error || 'Failed to assign exercise');
      }

      setAssigned(true);
      setTimeout(() => {
        setShowAssignModal(false);
        setAssigned(false);
        setAssignForm({ exercise_id: '', sets_per_day: 3, reps_per_set: 10, duration_days: 14 });
      }, 1200);
    } catch (err: any) {
      setAssignError(err?.message || 'Failed to assign exercise');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold text-teal-50 mb-2">Patients</h1>
          <p className="text-teal-600 text-sm">{MOCK_PATIENTS.length} active patients</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Add Patient
        </button>
      </div>

      <div className="space-y-3">
        {MOCK_PATIENTS.map(patient => (
          <div key={patient.id} className="card hover:border-teal-300/20 transition-all duration-200">
            <div className="flex items-center gap-5">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-teal-300/15 flex items-center justify-center flex-shrink-0 text-teal-300 font-medium text-sm">
                {patient.name.split(' ').map(n => n[0]).join('')}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-teal-100 font-medium text-sm">{patient.name}</div>
                <div className="text-teal-600 text-xs">{patient.injury}</div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-8 text-center">
                <div>
                  <div className="label mb-1">Exercises</div>
                  <div className="text-teal-200 text-sm font-mono">{patient.assigned}</div>
                </div>
                <div>
                  <div className="label mb-1">Compliance</div>
                  <ComplianceBadge rate={patient.compliance} />
                </div>
                <div>
                  <div className="label mb-1">Last Session</div>
                  <div className="text-teal-400 text-xs">{patient.lastSession}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 ml-4">
                <a href="/therapist/analytics" className="btn-ghost text-xs flex items-center gap-1.5 py-2">
                  <ClipboardList className="w-3.5 h-3.5" />
                  Analytics
                </a>
                <button onClick={() => { setSelectedPatient(patient.id); setShowAssignModal(true); }}
                  className="btn-primary text-xs flex items-center gap-1.5 py-2">
                  <Plus className="w-3.5 h-3.5" />
                  Assign
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md animate-fade-in">
            {assigned ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-teal-300 mx-auto mb-4" />
                <h3 className="font-display text-xl text-teal-50 mb-2">Exercise Assigned</h3>
                <p className="text-teal-600 text-sm">Patient will see this in their exercise queue.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-display text-xl text-teal-50">Assign Exercise</h3>
                  <button onClick={() => setShowAssignModal(false)}
                    className="w-8 h-8 rounded-lg bg-teal-300/5 flex items-center justify-center text-teal-600 hover:text-teal-300 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="label block mb-2">Patient</label>
                    <div className="input text-teal-300">
                      {MOCK_PATIENTS.find(p => p.id === selectedPatient)?.name}
                    </div>
                  </div>
                  <div>
                    <label className="label block mb-2">Exercise</label>
                    <select className="input" value={assignForm.exercise_id}
                      onChange={e => setAssignForm({ ...assignForm, exercise_id: e.target.value })}>
                      <option value="">{exercisesLoading ? 'Loading exercises…' : 'Select exercise…'}</option>
                      {exercises.map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.name}</option>
                      ))}
                    </select>
                    {!exercisesLoading && exercises.length === 0 && (
                      <p className="text-xs text-teal-700 mt-2">No exercises available yet. Create one first.</p>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: 'sets_per_day', label: 'Sets/Day', min: 1, max: 10 },
                      { key: 'reps_per_set', label: 'Reps/Set', min: 1, max: 30 },
                      { key: 'duration_days', label: 'Days', min: 1, max: 90 },
                    ].map(({ key, label, min, max }) => (
                      <div key={key}>
                        <label className="label block mb-2">{label}</label>
                        <input type="number" min={min} max={max}
                          value={assignForm[key as keyof typeof assignForm]}
                          onChange={e => setAssignForm({ ...assignForm, [key]: Number(e.target.value) })}
                          className="input text-center font-mono" />
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-teal-300/5 rounded-xl border border-teal-300/10 text-xs text-teal-600 font-mono">
                    {assignForm.sets_per_day} sets × {assignForm.reps_per_set} reps/set ×{' '}
                    {assignForm.duration_days} days = {assignForm.sets_per_day * assignForm.reps_per_set * assignForm.duration_days} total reps
                  </div>

                  <button onClick={handleAssign} disabled={!assignForm.exercise_id || exercisesLoading || isAssigning}
                    className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed">
                    {isAssigning ? 'Assigning…' : 'Confirm Assignment'}
                  </button>
                  {assignError && <p className="text-xs text-red-400">{assignError}</p>}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
