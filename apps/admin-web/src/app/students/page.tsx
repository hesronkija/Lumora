'use client';

import { AppShell } from '@/components/layout/app-shell';
import { useState } from 'react';
import { Search } from 'lucide-react';

export default function StudentsPage() {
  const [query, setQuery] = useState('');

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Students</h1>
            <p className="text-muted-foreground">Student registry and profiles</p>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or admission number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Admission No</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Class</th>
                <th className="px-4 py-3 text-left font-medium">Guardian</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {query ? `No results for "${query}"` : 'Students will appear here once enrolled'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
