import { Nav } from '@/components/ui/Nav';

const THERAPIST_TABS = [
  { href: '/therapist', label: 'Library' },
  { href: '/therapist/create', label: 'Create Exercise' },
  { href: '/therapist/patients', label: 'Patients' },
  { href: '/therapist/analytics', label: 'Analytics' },
];

export default function TherapistLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-teal-950">
      <div className="fixed inset-0 bg-grid pointer-events-none" />
      <Nav role="therapist" tabs={THERAPIST_TABS} />
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
