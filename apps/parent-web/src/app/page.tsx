export default function ParentDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1a1a2e] mb-6">My Children</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <PortalCard title="Fees & Payments" description="View invoices and pay fees" href="/fees" colour="blue" />
        <PortalCard title="Grades & Reports" description="View grades and download report cards" href="/grades" colour="green" />
        <PortalCard title="Attendance" description="Track daily attendance" href="/attendance" colour="amber" />
        <PortalCard title="Messages" description="Announcements from the school" href="/messages" colour="purple" />
      </div>
    </div>
  );
}

function PortalCard({ title, description, href, colour }: {
  title: string; description: string; href: string; colour: string;
}) {
  const colours: Record<string, string> = {
    blue: 'border-blue-200 hover:border-blue-400',
    green: 'border-green-200 hover:border-green-400',
    amber: 'border-amber-200 hover:border-amber-400',
    purple: 'border-purple-200 hover:border-purple-400',
  };
  return (
    <a
      href={href}
      className={`block bg-white border-2 rounded-xl p-5 transition-colors ${colours[colour] ?? ''}`}
    >
      <h2 className="text-lg font-semibold text-[#1a1a2e] mb-1">{title}</h2>
      <p className="text-sm text-gray-500">{description}</p>
    </a>
  );
}
