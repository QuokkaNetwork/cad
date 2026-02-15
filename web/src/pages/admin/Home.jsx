import { useNavigate } from 'react-router-dom';

const ADMIN_ITEMS = [
  {
    to: '/admin/users',
    title: 'Users',
    description: 'Manage access, admin rights, and bans.',
    color: 'bg-cad-accent',
  },
  {
    to: '/admin/departments',
    title: 'Departments',
    description: 'Create and manage departments, colors, and logos.',
    color: 'bg-emerald-500',
  },
  {
    to: '/admin/role-mappings',
    title: 'Role Mappings',
    description: 'Map Discord roles to CAD departments.',
    color: 'bg-[#5865F2]',
  },
  {
    to: '/admin/audit-log',
    title: 'Audit Log',
    description: 'Review administrative and system actions.',
    color: 'bg-amber-500',
  },
  {
    to: '/admin/settings',
    title: 'System Settings',
    description: 'Configure database and integration settings.',
    color: 'bg-vicpol-navy',
  },
];

function AdminCard({ item, onOpen }) {
  return (
    <button
      onClick={() => onOpen(item.to)}
      className="w-full text-left bg-cad-card border border-cad-border rounded-2xl p-5 min-h-[148px] hover:bg-cad-surface transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-base">{item.title}</h3>
          <p className="text-sm text-cad-muted mt-1">{item.description}</p>
        </div>
        <span className={`w-3 h-3 rounded-full mt-1.5 ${item.color}`} />
      </div>
      <p className="text-xs text-cad-muted mt-4">Open {item.title}</p>
    </button>
  );
}

export default function AdminHome() {
  const navigate = useNavigate();

  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto">
        <div className="mb-5">
          <h2 className="text-xl font-bold">Administration</h2>
          <p className="text-sm text-cad-muted">Choose an admin section.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
          {ADMIN_ITEMS.map(item => (
            <AdminCard key={item.to} item={item} onOpen={navigate} />
          ))}
        </div>
      </div>
    </div>
  );
}
