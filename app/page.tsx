import Link from 'next/link';
import { Activity, Users } from 'lucide-react';

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
            MoveMentor
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

        {/* Tech stack footer */}
        <div className="text-center mt-16 text-xs font-mono text-teal-800 tracking-widest">
          MOVENET · TENSORFLOW.JS · NEXT.JS 14 · SUPABASE · RECHARTS
        </div>
      </div>
    </div>
  );
}
