import { Link, Outlet } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export default function Layout() {
  const [isDark, setIsDark] = useState<boolean>(
    () => (localStorage.getItem('theme') ?? 'dark') === 'dark'
  )

  useEffect(() => {
    const html = document.documentElement
    if (isDark) {
      html.classList.remove('light')
      html.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      html.classList.remove('dark')
      html.classList.add('light')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

  return (
    <div className="min-h-screen bg-navy-900 text-white transition-colors duration-200">
      <header className="bg-navy-800 border-b border-navy-700 px-6 py-3">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#8892b0]">HPC Management</p>
            <h1 className="text-lg font-bold text-white leading-tight">Slurm Web UI</h1>
          </div>

          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-1">
              {(
                [
                  { to: '/',           label: 'Overview'        },
                  { to: '/nodes',      label: 'Nodes'           },
                  { to: '/partitions', label: 'Partitions'      },
                  { to: '/gpu',        label: 'GPU Utilization' },
                  { to: '/jobs',       label: 'Jobs'            },
                  { to: '/history',    label: 'Job History'     },
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

            {/* Theme toggle */}
            <button
              onClick={() => setIsDark(d => !d)}
              aria-label="Toggle theme"
              className={`relative flex-shrink-0 w-14 h-7 rounded-full border transition-colors duration-300 ${
                isDark
                  ? 'bg-navy-700 border-navy-600'
                  : 'bg-[#d0d9ec] border-[#b5c2d8]'
              }`}
            >
              <span
                className={`absolute top-0.5 w-6 h-6 rounded-full flex items-center justify-center shadow transition-all duration-300 ${
                  isDark
                    ? 'left-0.5 bg-[#a78bfa]'
                    : 'left-[30px] bg-[#f6ad55]'
                }`}
              >
                {isDark
                  ? <Moon className="w-3.5 h-3.5 text-white" />
                  : <Sun  className="w-3.5 h-3.5 text-white" />
                }
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
