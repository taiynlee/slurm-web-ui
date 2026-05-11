import { useState, useCallback, useMemo } from 'react'
import { api } from '../lib/api'
import { dur, ts } from '../lib/slurm'
import { Tooltip } from '../components/Tooltip'

const STATE_COLOR: Record<string, string> = {
  COMPLETED:      '#68d391',
  RUNNING:        '#00d4b0',
  FAILED:         '#e53e3e',
  CANCELLED:      '#a0aec0',
  TIMEOUT:        '#f6ad55',
  NODE_FAIL:      '#fc8181',
  PREEMPTED:      '#b794f4',
  OUT_OF_MEMORY:  '#f6ad55',
}

function StateBadge({ state }: { state: string }) {
  const color = STATE_COLOR[state?.toUpperCase?.()] ?? '#8892b0'
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: color + '20', color }}
    >
      {state}
    </span>
  )
}

const THREE_MONTHS_AGO = (() => {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d
})()

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function dateInputToTs(val: string, endOfDay = false): number {
  const d = new Date(val)
  if (endOfDay) d.setHours(23, 59, 59, 999)
  else d.setHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}

const MIN_DATE    = toDateInput(THREE_MONTHS_AGO)
const DEFAULT_END = toDateInput(new Date())

export default function History() {
  const [startDate,  setStartDate]  = useState(MIN_DATE)
  const [endDate,    setEndDate]    = useState(DEFAULT_END)
  const [nodeFilter, setNodeFilter] = useState('ALL')

  // client-side filters
  const [nameFilter,  setNameFilter]  = useState('ALL')
  const [userFilter,  setUserFilter]  = useState('ALL')
  const [stateFilter, setStateFilter] = useState('ALL')

  const [allJobs, setAllJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [queried, setQueried] = useState(false)

  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const search_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, any> = {
        start_ts: dateInputToTs(startDate, false),
        end_ts:   dateInputToTs(endDate,   true),
      }
      if (nodeFilter !== 'ALL') params.nodes = nodeFilter

      const res = await api.get('/cluster/history', { params })
      const data = res.data
      if (data.error) throw new Error(data.error)
      setAllJobs(data.jobs ?? [])
      setNameFilter('ALL')
      setUserFilter('ALL')
      setStateFilter('ALL')
      setQueried(true)
    } catch (e: any) {
      setError(e.message ?? 'Failed to fetch history')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, nodeFilter])

  const names = useMemo(() =>
    ['ALL', ...Array.from(new Set(allJobs.map(j => j.name).filter(Boolean))).sort()],
    [allJobs]
  )
  const users = useMemo(() =>
    ['ALL', ...Array.from(new Set(allJobs.map(j => j.user).filter(Boolean))).sort()],
    [allJobs]
  )
  const states = useMemo(() =>
    ['ALL', ...Array.from(new Set(allJobs.map(j => j.state).filter(Boolean))).sort()],
    [allJobs]
  )

  const filtered = useMemo(() =>
    allJobs.filter(j => {
      if (stateFilter !== 'ALL' && (j.state ?? '').toUpperCase() !== stateFilter) return false
      if (nameFilter  !== 'ALL' && j.name   !== nameFilter)  return false
      if (userFilter  !== 'ALL' && j.user   !== userFilter)  return false
      return true
    }),
    [allJobs, stateFilter, nameFilter, userFilter]
  )

  const avgElapsed = useMemo(() => {
    const vals = filtered.map(j => j.elapsed).filter((v): v is number => typeof v === 'number' && v >= 0)
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  }, [filtered])

  const sorted = useMemo(() => {
    if (!sortCol) return filtered
    return [...filtered].sort((a, b) => {
      const av = a[sortCol] ?? ''
      const bv = b[sortCol] ?? ''
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortCol, sortDir])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <Tooltip tip="Historical jobs that ran on aidgxapp01 and aidgxapp02, sourced from slurmdbd\n從 slurmdbd 取得在 aidgxapp01 與 aidgxapp02 上執行過的歷史工作">
          <h1 className="text-2xl font-bold text-white cursor-help">Job History（歷史工作）</h1>
        </Tooltip>
        <p className="text-sm text-[#8892b0] mt-0.5">
          最多查詢 1 個月內資料 · up to 1 month
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {/* Search block */}
        <div className="bg-navy-800 rounded-2xl border border-navy-700 px-4 pt-3 pb-3 flex flex-col gap-3 min-w-fit">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#8892b0]">Search</span>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#8892b0]">開始 Start</label>
              <input
                type="date"
                value={startDate}
                min={MIN_DATE}
                max={endDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-navy-900 border border-navy-700 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#8892b0]">結束 End</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={DEFAULT_END}
                onChange={e => setEndDate(e.target.value)}
                className="bg-navy-900 border border-navy-700 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#8892b0]">節點 Node</label>
              <select
                value={nodeFilter}
                onChange={e => setNodeFilter(e.target.value)}
                className="bg-navy-900 border border-navy-700 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal-400 cursor-pointer"
              >
                <option value="ALL">All Nodes</option>
                <option value="aidgxapp01">aidgxapp01</option>
                <option value="aidgxapp02">aidgxapp02</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#8892b0] invisible">.</label>
              <button
                onClick={search_}
                disabled={loading}
                className="px-5 py-1.5 rounded-xl text-sm font-semibold bg-teal-500 hover:bg-teal-400 text-navy-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '查詢中…' : 'Search'}
              </button>
            </div>
          </div>
        </div>

        {/* Filter block */}
        <div className="bg-navy-800 rounded-2xl border border-navy-700 px-4 pt-3 pb-3 flex flex-col gap-3 min-w-fit">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#8892b0]">Filter</span>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#8892b0]">狀態 State</label>
              <select
                value={stateFilter}
                onChange={e => setStateFilter(e.target.value)}
                className="bg-navy-900 border border-navy-700 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal-400 cursor-pointer"
              >
                {states.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All States' : s}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#8892b0]">名稱 Name</label>
              <select
                value={nameFilter}
                onChange={e => setNameFilter(e.target.value)}
                className="bg-navy-900 border border-navy-700 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal-400 cursor-pointer max-w-[200px]"
              >
                {names.map(n => <option key={n} value={n}>{n === 'ALL' ? 'All Names' : n}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[#8892b0]">使用者 User</label>
              <select
                value={userFilter}
                onChange={e => setUserFilter(e.target.value)}
                className="bg-navy-900 border border-navy-700 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal-400 cursor-pointer"
              >
                {users.map(u => <option key={u} value={u}>{u === 'ALL' ? 'All Users' : u}</option>)}
              </select>
            </div>
            {queried && (
              <div className="flex flex-col self-end pb-1.5 gap-0.5">
                <span className="text-sm text-[#8892b0]">{filtered.length} / {allJobs.length} 筆</span>
                {avgElapsed !== null && (
                  <span className="text-xs text-[#fc8181]">平均時長 {dur(avgElapsed)}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-400 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-xl bg-[#2d1b1b] border border-[#e53e3e]/30 p-5 text-[#fc8181]">{error}</div>
      ) : queried && filtered.length === 0 ? (
        <div className="rounded-xl bg-navy-800 border border-navy-700 p-8 text-center text-[#8892b0]">
          沒有符合條件的工作記錄 No matching jobs found
        </div>
      ) : queried ? (
        <div className="bg-navy-800 rounded-2xl border border-navy-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-700 text-[#8892b0] text-xs uppercase tracking-wider">
                {([
                  { label: 'Job ID',        col: 'job_id',     align: 'left'  },
                  { label: '名稱 Name',      col: 'name',       align: 'left'  },
                  { label: '使用者 User',    col: 'user',       align: 'left'  },
                  { label: '節點 Node',      col: 'nodes',      align: 'left'  },
                  { label: '狀態 State',     col: 'state',      align: 'left'  },
                  { label: 'CPU',            col: 'cpus',       align: 'right' },
                  { label: 'GPU',            col: 'gpus',       align: 'right' },
                  { label: '開始時間 Start', col: 'start_time', align: 'left'  },
                  { label: '結束時間 End',   col: 'end_time',   align: 'left'  },
                  { label: '時長 Duration',  col: 'elapsed',    align: 'right' },
                ] as const).map(({ label, col, align }) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className={`px-4 py-3 cursor-pointer select-none hover:text-white transition-colors text-${align}`}
                  >
                    {label}
                    {sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((job, i) => (
                <tr
                  key={i}
                  className="border-b border-navy-700/50 hover:bg-navy-700/30 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-teal-400 font-bold">#{job.job_id}</td>
                  <td className="px-4 py-3 text-white max-w-[180px] truncate" title={job.name ?? ''}>
                    {job.name ?? <span className="text-[#4a5568]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-[#8892b0]">{job.user ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#a0aec0]">{job.nodes ?? '—'}</td>
                  <td className="px-4 py-3"><StateBadge state={job.state} /></td>
                  <td className="px-4 py-3 text-right text-[#4299e1]">{job.cpus ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-[#a78bfa]">
                    {job.gpus != null ? job.gpus : <span className="text-[#4a5568]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-[#8892b0] text-xs whitespace-nowrap">
                    {job.start_time
                      ? ts({ set: true, infinite: false, number: job.start_time })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#8892b0] text-xs whitespace-nowrap">
                    {job.end_time && job.end_time < 4000000000
                      ? ts({ set: true, infinite: false, number: job.end_time })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-white font-mono text-xs">
                    {job.elapsed != null ? dur(job.elapsed) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
