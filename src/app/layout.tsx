import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const metadata: Metadata = {
  title: 'ADAPTIQ — Adaptive Intelligence for Personalized Learning',
  description:
    'Turn your course materials into a personalized AI learning system that understands what you study, what you know, and what you should learn next.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#F8F2E3] text-[#26313D] min-h-screen selection:bg-[#B1A15A]/30 selection:text-[#26313D]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
