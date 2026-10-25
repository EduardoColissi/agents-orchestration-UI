import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Getnet Support — Multi-Agent Chat',
  description: 'Chat UI for the Getnet multi-agent support API (Router · Knowledge · Support · Escalation · Personality)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
