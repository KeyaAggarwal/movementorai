import type { Metadata } from 'next';
import { DM_Sans, DM_Mono, Playfair_Display } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['300', '400', '500', '600'],
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-dm-mono',
  weight: ['400', '500'],
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'PhysioAI — AI-Assisted Rehabilitation',
  description: 'Real-time pose-guided rehabilitation platform for therapists and patients.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable} ${playfair.variable}`}>
      <body className="bg-teal-950 text-teal-50 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
