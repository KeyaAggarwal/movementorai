'use client';

import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const ROM_DATA = [
  { week: 'Wk 1', rom: 55, accuracy: 72 },
  { week: 'Wk 2', rom: 62, accuracy: 75 },
  { week: 'Wk 3', rom: 69, accuracy: 79 },
  { week: 'Wk 4', rom: 76, accuracy: 82 },
  { week: 'Wk 5', rom: 82, accuracy: 84 },
  { week: 'Wk 6', rom: 91, accuracy: 87 },
];

const COMPLIANCE_DATA = [
  { day: 'Mon', completed: 3, assigned: 3 },
  { day: 'Tue', completed: 2, assigned: 3 },
  { day: 'Wed', completed: 3, assigned: 3 },
  { day: 'Thu', completed: 1, assigned: 3 },
  { day: 'Fri', completed: 3, assigned: 3 },
  { day: 'Sat', completed: 2, assigned: 3 },
  { day: 'Sun', completed: 0, assigned: 3 },
];

const JOINT_ERRORS = [
  { joint: 'elbow_right', avg_error: 8.2 },
  { joint: 'wrist_right', avg_error: 14.1 },
  { joint: 'shoulder_right', avg_error: 3.4 },
  { joint: 'elbow_left', avg_error: 5.7 },
  { joint: 'wrist_left', avg_error: 6.9 },
];

const tooltipStyle = {
  backgroundColor: '#0a1f1c',
  border: '1px solid rgba(99,202,183,0.2)',
  borderRadius: '12px',
  color: '#63CAB7',
  fontSize: '12px',
  fontFamily: 'var(--font-dm-mono)',
};

function StatCard({ label, value, unit, delta, deltaLabel }: {
  label: string; value: string | number; unit?: string; delta?: number; deltaLabel?: string;
}) {
  return (
    <div className="card">
      <div className="label mb-2">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="stat-value">{value}</span>
        {unit && <span className="text-sm text-teal-400">{unit}</span>}
      </div>
      {delta !== undefined && (
        <div className="text-xs text-teal-400 mt-2">
          ↑ {delta}{deltaLabel} from last week
        </div>
      )}
    </div>
  );
}

export default function AnalyticsDashboard() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-teal-50 mb-2">Analytics Dashboard</h1>
        <p className="text-teal-600 text-sm">Sarah Chen · Wrist Rotation Rehab · Week 6 of 8</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Compliance" value={87} unit="%" delta={4} deltaLabel="%" />
        <StatCard label="Avg Accuracy" value={84} unit="/100" delta={3} deltaLabel="pts" />
        <StatCard label="ROM Improvement" value="+36" unit="°" />
        <StatCard label="Sessions" value={42} unit="total" />
      </div>

      {/* Main charts */}
      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* ROM + Accuracy trend */}
        <div className="card">
          <div className="label mb-1">Recovery Progress</div>
          <div className="font-display text-lg text-teal-50 mb-4">ROM & Accuracy Over Time</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={ROM_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,202,183,0.06)" />
              <XAxis dataKey="week" tick={{ fill: '#6b8a85', fontSize: 11, fontFamily: 'var(--font-dm-mono)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b8a85', fontSize: 11, fontFamily: 'var(--font-dm-mono)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--font-dm-mono)', color: '#6b8a85' }} />
              <Line type="monotone" dataKey="rom" stroke="#63CAB7" strokeWidth={2} dot={{ fill: '#63CAB7', r: 3 }} name="ROM (°)" />
              <Line type="monotone" dataKey="accuracy" stroke="rgba(99,202,183,0.4)" strokeWidth={2} strokeDasharray="4 2" dot={{ fill: 'rgba(99,202,183,0.4)', r: 3 }} name="Accuracy" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Compliance */}
        <div className="card">
          <div className="label mb-1">This Week</div>
          <div className="font-display text-lg text-teal-50 mb-4">Daily Compliance</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={COMPLIANCE_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,202,183,0.06)" />
              <XAxis dataKey="day" tick={{ fill: '#6b8a85', fontSize: 11, fontFamily: 'var(--font-dm-mono)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b8a85', fontSize: 11, fontFamily: 'var(--font-dm-mono)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="assigned" fill="rgba(99,202,183,0.1)" radius={[4, 4, 0, 0]} name="Assigned" />
              <Bar dataKey="completed" fill="#63CAB7" radius={[4, 4, 0, 0]} name="Completed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Joint error breakdown + session log */}
      <div className="grid grid-cols-2 gap-5">
        <div className="card">
          <div className="label mb-1">Motion Quality</div>
          <div className="font-display text-lg text-teal-50 mb-4">Avg Joint Error by Joint</div>
          <div className="space-y-3">
            {JOINT_ERRORS.sort((a, b) => b.avg_error - a.avg_error).map(({ joint, avg_error }) => (
              <div key={joint}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-mono text-teal-500">{joint}</span>
                  <span className={`font-mono font-medium ${avg_error > 12 ? 'text-red-400' : 'text-teal-300'}`}>
                    {avg_error.toFixed(1)}° {avg_error > 12 ? '⚠' : '✓'}
                  </span>
                </div>
                <div className="h-1.5 bg-teal-300/10 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${avg_error > 12 ? 'bg-red-500/60' : 'bg-teal-400/60'}`}
                    style={{ width: `${Math.min(100, (avg_error / 20) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-teal-300/10 text-xs text-teal-700 font-mono">
            Threshold: &gt;12° = correction needed
          </div>
        </div>

        <div className="card">
          <div className="label mb-1">Recent Activity</div>
          <div className="font-display text-lg text-teal-50 mb-4">Session Log</div>
          <div className="space-y-3">
            {[
              { date: 'Today 10:30', reps: 30, accuracy: 84, rom: 80 },
              { date: 'Today 08:15', reps: 28, accuracy: 81, rom: 78 },
              { date: 'Yesterday 18:00', reps: 30, accuracy: 86, rom: 82 },
              { date: 'Yesterday 09:00', reps: 25, accuracy: 79, rom: 75 },
              { date: '2 days ago', reps: 30, accuracy: 83, rom: 77 },
            ].map((session, i) => (
              <div key={i} className="flex items-center gap-4 py-2 border-b border-teal-300/5 last:border-0">
                <div className="text-teal-700 text-xs font-mono w-32 flex-shrink-0">{session.date}</div>
                <div className="flex-1 flex gap-4 text-xs">
                  <span className="text-teal-500">{session.reps} reps</span>
                  <span className="text-teal-300 font-mono">{session.accuracy}% acc</span>
                  <span className="text-teal-400">{session.rom}° ROM</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
