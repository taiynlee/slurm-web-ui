import { Link, Outlet } from '@tanstack/react-router'

export default function Layout() {
  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <header className="bg-navy-800 border-b border-navy-700 px-6 py-3">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#8892b0]">HPC Management</p>
            <h1 className="text-lg font-bold text-white leading-tight">Slurm Web UI</h1>
          </div>
          <nav className="flex items-center gap-1">
            {(
              [
                { to: '/',           label: 'Overview'   },
                { to: '/nodes',      label: 'Nodes'      },
                { to: '/partitions', label: 'Partitions' },
                { to: '/jobs',       label: 'Jobs'       },
              ] as const
            ).map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="px-4 py-2 rounded-lg text-sm text-[#8892b0] hover:text-white hover:bg-navy-700 transition-colors"
                activeProps={{ className: 'px-4 py-2 rounded-lg text-sm text-white bg-navy-700' }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-screen-xl mx-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
