'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavProps {
  role: 'therapist' | 'patient';
  tabs: { href: string; label: string }[];
}

export function Nav({ role, tabs }: NavProps) {
  const path = usePathname();

  return (
    <nav className="border-b border-teal-300/10 bg-teal-950/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 flex items-center gap-6 h-14">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mr-4 group">
          <ChevronLeft className="w-3.5 h-3.5 text-teal-600 group-hover:text-teal-400 transition-colors" />
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-600 to-teal-300 flex items-center justify-center text-teal-950 font-bold text-xs">
            P
          </div>
          <span className="text-sm font-medium text-teal-200">PhysioAI</span>
        </Link>

        {/* Role badge */}
        <div className="text-[10px] font-mono tracking-widest text-teal-600 uppercase border border-teal-300/10 px-2.5 py-1 rounded-full">
          {role}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 ml-auto">
          {tabs.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'text-sm px-4 py-2 rounded-lg transition-all duration-200',
                path === href || path.startsWith(href + '/')
                  ? 'bg-teal-300/10 text-teal-300 font-medium'
                  : 'text-teal-600 hover:text-teal-400'
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
