'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const HISTORY = [
  { date: 'Mar 1', accuracy: 79, rom: 68, reps: 28 },
  { date: 'Mar 2', accuracy: 81, rom: 70, reps: 30 },
  { date: 'Mar 3', accuracy: 80, rom: 72, reps: 29 },
  { date: 'Mar 4', accuracy: 83, rom: 75, reps: 30 },
  { date: 'Mar 5', accuracy: 82, rom: 77, reps: 30 },
  { date: 'Mar 6', accuracy: 85, rom: 79, reps: 30 },
  { date: 'Mar 7', accuracy: 84, rom: 80, reps: 30 },
];

const tooltipStyle = {
  backgroundColor: '#0a1f1c',
  border: '1px solid rgba(99,202,183,0.2)',
  borderRadius: '12px',
  color: '#63CAB7',
  fontSize: '11px',
  fontFamily: 'var(--font-dm-mono)',
};

export default function PatientHistory() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-teal-50 mb-2">Exercise History</h1>
        <p className="text-teal-600 text-sm">Wrist Rotation Rehab · Last 7 days</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'This Week', value: '7', unit: 'sessions', delta: '+2 vs last week' },
          { label: 'Avg Accuracy', value: '82', unit: '%', delta: '+3% vs last week' },
          { label: 'ROM Gain', value: '+12', unit: '°', delta: 'this week' },
        ].map(({ label, value, unit, delta }) => (
          <div key={label} className="card">
            <div className="label mb-2">{label}</div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-mono text-teal-50">{value}</span>
              <span className="text-sm text-teal-400">{unit}</span>
            </div>
            <div className="text-xs text-teal-500 mt-2">↑ {delta}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5 mb-5">
        <div className="card">
          <div className="label mb-1">Accuracy Trend</div>
          <div className="font-display text-lg text-teal-50 mb-4">Motion Quality</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={HISTORY} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="acc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#63CAB7" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#63CAB7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,202,183,0.06)" />
              <XAxis dataKey="date" tick={{ fill: '#6b8a85', fontSize: 10, fontFamily: 'var(--font-dm-mono)' }} axisLine={false} tickLine={false} />
              <YAxis domain={[70, 100]} tick={{ fill: '#6b8a85', fontSize: 10, fontFamily: 'var(--font-dm-mono)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="accuracy" stroke="#63CAB7" strokeWidth={2} fill="url(#acc)" name="Accuracy %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="label mb-1">ROM Trend</div>
          <div className="font-display text-lg text-teal-50 mb-4">Range of Motion</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={HISTORY} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="rom" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3db5a0" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3db5a0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,202,183,0.06)" />
              <XAxis dataKey="date" tick={{ fill: '#6b8a85', fontSize: 10, fontFamily: 'var(--font-dm-mono)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b8a85', fontSize: 10, fontFamily: 'var(--font-dm-mono)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="rom" stroke="#3db5a0" strokeWidth={2} fill="url(#rom)" name="ROM °" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Session log */}
      <div className="card">
        <div className="label mb-4">Session Log</div>
        <div className="space-y-2">
          {HISTORY.slice().reverse().map((s, i) => (
            <div key={i} className="flex items-center gap-6 py-3 border-b border-teal-300/5 last:border-0">
              <div className="text-sm font-mono text-teal-500 w-16 flex-shrink-0">{s.date}</div>
              <div className="flex-1 h-1.5 bg-teal-300/10 rounded-full overflow-hidden">
                <div className="h-full bg-teal-300/50 rounded-full" style={{ width: `${(s.reps / 30) * 100}%` }} />
              </div>
              <div className="flex gap-6 text-sm flex-shrink-0">
                <span className="font-mono text-teal-400">{s.reps} reps</span>
                <span className={`font-mono font-medium ${s.accuracy >= 83 ? 'text-teal-300' : 'text-teal-500'}`}>{s.accuracy}% acc</span>
                <span className="font-mono text-teal-400">{s.rom}° ROM</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
