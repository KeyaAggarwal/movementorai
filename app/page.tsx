import Link from 'next/link';
import { Activity, Users, BarChart3, Zap } from 'lucide-react';

const features = [
  { icon: Zap, title: 'Real-Time Pose Detection', desc: 'MoveNet via TensorFlow.js runs entirely in-browser — no server round-trips.' },
  { icon: Activity, title: 'Ghost Skeleton Guidance', desc: 'Therapist reference skeleton overlaid on patient\'s live camera feed with deviation highlighting.' },
  { icon: BarChart3, title: 'Recovery Analytics', desc: 'ROM trend charts, accuracy scores, and compliance tracking per patient over time.' },
  { icon: Users, title: 'Therapist–Patient Loop', desc: 'Full assignment system: create exercises, assign to patients, monitor progress.' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-teal-950 relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 bg-grid pointer-events-none" />
      <div className="fixed inset-0 bg-radial-glow pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="text-center mb-20 animate-fade-in">
          <div className="inline-flex items-center gap-2 bg-teal-300/10 border border-teal-300/20 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-300 animate-pulse" />
            <span className="text-xs font-mono text-teal-400 tracking-wider">AI-ASSISTED REHABILITATION</span>
          </div>

          <h1 className="font-display text-6xl font-semibold text-teal-50 mb-6 leading-tight">
            PhysioAI
          </h1>
          <p className="text-teal-500 text-lg max-w-xl mx-auto leading-relaxed">
            Real-time pose-guided rehabilitation. Ghost skeleton overlay. Automatic rep counting and ROM tracking.
          </p>
        </div>

        {/* Role selector */}
        <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto mb-20">
          <Link href="/therapist" className="group card hover:border-teal-300/30 transition-all duration-300 cursor-pointer">
            <div className="w-12 h-12 rounded-xl bg-teal-300/10 flex items-center justify-center mb-4 group-hover:bg-teal-300/20 transition-colors">
              <Users className="w-5 h-5 text-teal-300" />
            </div>
            <h2 className="text-teal-50 font-medium text-lg mb-2">Therapist</h2>
            <p className="text-teal-600 text-sm leading-relaxed">
              Upload exercises, define motion steps, assign to patients, and monitor recovery dashboards.
            </p>
            <div className="mt-4 text-xs font-mono text-teal-400 tracking-wider">
              ENTER PORTAL →
            </div>
          </Link>

          <Link href="/patient" className="group card hover:border-teal-300/30 transition-all duration-300 cursor-pointer">
            <div className="w-12 h-12 rounded-xl bg-teal-300/10 flex items-center justify-center mb-4 group-hover:bg-teal-300/20 transition-colors">
              <Activity className="w-5 h-5 text-teal-300" />
            </div>
            <h2 className="text-teal-50 font-medium text-lg mb-2">Patient</h2>
            <p className="text-teal-600 text-sm leading-relaxed">
              Perform assigned exercises with real-time ghost skeleton guidance and live accuracy feedback.
            </p>
            <div className="mt-4 text-xs font-mono text-teal-400 tracking-wider">
              ENTER PORTAL →
            </div>
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-4 max-w-3xl mx-auto">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card-sm flex gap-4">
              <div className="w-8 h-8 rounded-lg bg-teal-300/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-teal-300" />
              </div>
              <div>
                <div className="text-teal-100 text-sm font-medium mb-1">{title}</div>
                <div className="text-teal-600 text-xs leading-relaxed">{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tech stack footer */}
        <div className="text-center mt-16 text-xs font-mono text-teal-800 tracking-widest">
          MOVENET · TENSORFLOW.JS · NEXT.JS 14 · SUPABASE · RECHARTS
        </div>
      </div>
    </div>
  );
}
