import { Nav } from '@/components/ui/Nav';

const PATIENT_TABS = [
  { href: '/patient', label: 'My Exercises' },
  { href: '/patient/history', label: 'History' },
];

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-teal-950">
      <div className="fixed inset-0 bg-grid pointer-events-none" />
      <Nav role="patient" tabs={PATIENT_TABS} />
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
