import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Lumora Parent Portal',
  description: 'School parent portal — fees, grades, attendance',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-TZ">
      <body className={inter.className}>
        <header className="bg-[#1a1a2e] text-white px-6 py-4 flex items-center justify-between">
          <span className="text-lg font-bold">Lumora Parent Portal</span>
          <nav className="flex gap-4 text-sm">
            <a href="/fees" className="hover:underline">Fees</a>
            <a href="/grades" className="hover:underline">Grades</a>
            <a href="/attendance" className="hover:underline">Attendance</a>
            <a href="/messages" className="hover:underline">Messages</a>
          </nav>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
