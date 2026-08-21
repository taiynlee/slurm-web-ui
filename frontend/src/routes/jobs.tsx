import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useApiData } from '../hooks/useCluster'
import { n, state0, ts, mins, parseTres, dur } from '../lib/slurm'
import { Tooltip } from '../components/Tooltip'

const STATE_COLOR: Record<string, string> = {
  RUNNING: '#00d4b0', PENDING: '#4299e1', COMPLETED: '#68d391',
  FAILED: '#e53e3e', CANCELLED: '#a0aec0', TIMEOUT: '#f6ad55',
}
const STATE_TIP: Record<string, string> = {
  RUNNING:   'Job is actively executing on compute nodes\n工作正在運算節點上執行中',
  PENDING:   'Job is waiting in the queue for resources to become available\n工作正在佇列中等待資源',
  COMPLETED: 'Job finished successfully with exit code 0\n工作已成功完成（結束碼 0）',
  FAILED:    'Job exited with a non-zero exit code\n工作以非零結束碼退出',
  CANCELLED: 'Job was cancelled by a user or system administrator\n工作被使用者或管理員取消',
  TIMEOUT:   'Job was killed after exceeding its configured time limit\n工作超過設定的時間限制而被終止',
}

function StateBadge({ state }: { state: string }) {
  const color = STATE_COLOR[state?.toUpperCase?.()] ?? '#8892b0'
  const tip = STATE_TIP[state?.toUpperCase?.()] ?? `Job state: ${state}`
  return (
    <Tooltip tip={tip}>
      <span
        className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-help"
        style={{ backgroundColor: color + '20', color }}
      >
        {state}
      </span>
    </Tooltip>
  )
}

function MetricCell({ label, value, tip, color }: {
  label: string; value: React.ReactNode; tip: string; color?: string
}) {
  return (
    <div>
      <Tooltip tip={tip}>
        <p className="text-xs text-[#8892b0] mb-0.5 cursor-help">{label}</p>
      </Tooltip>
      <p className="text-sm font-semibold" style={{ color: color ?? '#ffffff' }}>{value}</p>
    </div>
  )
}

function gpuFromTres(tres: string): string {
  const t = parseTres(tres)
  const gpu = t['gres/gpu'] ?? t['gpu']
  return gpu ? `${gpu} GPU` : '—'
}

export default function Jobs() {
  const { data, loading, error } = useApiData<any>('/cluster/jobs')
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('ALL')
  const [nodeFilter, setNodeFilter] = useState('ALL')
  const jobs: any[] = data?.jobs ?? (Array.isArray(data) ? data : [])

  const states = ['ALL', ...Array.from(new Set(jobs.map(j => {
    const s = j.job_state ?? j.state
    return state0(s).toUpperCase()
  }))).sort()]

  const nodes = ['ALL', ...Array.from(new Set(
    jobs.map(j => String(j.nodes ?? '')).filter(Boolean)
  )).sort()]

  const filtered = jobs.filter(job => {
    const s = state0(job.job_state ?? job.state).toUpperCase()
    if (stateFilter !== 'ALL' && s !== stateFilter) return false
    if (nodeFilter !== 'ALL' && String(job.nodes ?? '') !== nodeFilter) return false
    const name = String(job.name ?? '')
    const user = String(job.user_name ?? job.user ?? '')
    return (name + user).toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Tooltip tip="All jobs currently tracked by the Slurm scheduler — running, pending, and recently completed\nSlurm 排程器目前追蹤的所有工作（執行中、等待中及近期完成）">
            <h1 className="text-2xl font-bold text-white cursor-help">Job Queue（工作佇列）</h1>
          </Tooltip>
          <p className="text-sm text-[#8892b0] mt-0.5">
            Current jobs — refreshes every 1 min ·{' '}
            <Tooltip tip="Total number of jobs currently in the Slurm job database\nSlurm 工作資料庫中目前的工作總數">
              <span className="cursor-help">{jobs.length} total</span>
            </Tooltip>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Tooltip tip="Filter jobs by their current execution state\n依工作目前的執行狀態篩選">
            <select
              value={stateFilter}
              onChange={e => setStateFilter(e.target.value)}
              className="bg-navy-800 border border-navy-700 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal-400 cursor-pointer"
            >
              {states.map(s => <option key={s}>{s}</option>)}
            </select>
          </Tooltip>
          <Tooltip tip="Filter jobs by the compute node they are running on\n依工作執行的運算節點篩選">
            <select
              value={nodeFilter}
              onChange={e => setNodeFilter(e.target.value)}
              className="bg-navy-800 border border-navy-700 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal-400 cursor-pointer"
            >
              {nodes.map(n => <option key={n}>{n}</option>)}
            </select>
          </Tooltip>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name / user…"
            className="bg-navy-800 border border-navy-700 rounded-xl px-3 py-1.5 text-sm text-white placeholder-[#4a5568] focus:outline-none focus:border-teal-400"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-400 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-xl bg-[#2d1b1b] border border-[#e53e3e]/30 p-5 text-[#fc8181]">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-navy-800 border border-navy-700 p-8 text-center text-[#8892b0]">No jobs found</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((job: any, i: number) => {
            const jobId     = job.job_id ?? job.jobId ?? job.id
            const stateStr  = state0(job.job_state ?? job.state).toUpperCase()
            const cpuCount  = n(job.cpus) ?? n(job.num_cpus) ?? '—'
            const gpus      = gpuFromTres(job.tres_req_str ?? job.tres_per_job ?? '')
            const timeLimit = job.time_limit

            const submitTs = n(job.submit_time)
            const startTs  = n(job.start_time)
            const endTs    = n(job.end_time)
            const nowTs    = Math.floor(Date.now() / 1000)

            const waitSecs    = (startTs && submitTs) ? startTs - submitTs : null
            const runSecs     = startTs
              ? stateStr === 'RUNNING' ? nowTs - startTs : (endTs ? endTs - startTs : null)
              : null
            const timeLimitInf = job.time_limit?.infinite === true
            const remainSecs  = (stateStr === 'RUNNING' && !timeLimitInf && endTs)
              ? endTs - nowTs : null

            const stateColor = STATE_COLOR[stateStr] ?? '#8892b0'

            return (
              <div key={jobId ?? i} className="bg-navy-800 rounded-2xl border border-navy-700 p-4">
                {/* Header */}
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <Tooltip tip="Click to view detailed job information including resources, timing, and I/O paths\n點擊查看此工作的詳細資訊，包含資源、時間與輸出路徑">
                    <Link
                      to="/jobs/$jobId"
                      params={{ jobId: String(jobId) }}
                      className="text-teal-400 hover:text-teal-300 font-mono font-bold text-sm hover:underline"
                    >
                      #{jobId}
                    </Link>
                  </Tooltip>
                  <span className="text-white font-semibold text-sm truncate flex-1 min-w-0">
                    {job.name ?? '—'}
                  </span>
                  <StateBadge state={stateStr} />
                  <Tooltip tip="Slurm partition this job was submitted to\n此工作提交的 Slurm 分區">
                    <span className="text-xs px-2 py-0.5 rounded-full border cursor-help"
                      style={{ borderColor: stateColor + '40', color: stateColor, backgroundColor: stateColor + '10' }}>
                      {job.partition ?? '—'}
                    </span>
                  </Tooltip>
                  <Tooltip tip="Username / Slurm account charged for this job's resource usage ('none' if not specified at submission)\n使用者 / 此工作計費的 Slurm 帳號（提交時未指定則顯示 none）">
                    <span className="text-xs text-[#8892b0] cursor-help">{job.user_name ?? job.user ?? '—'}/{job.account || 'none'}</span>
                  </Tooltip>
                </div>

                {/* Resources + Timing grid */}
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-x-6 gap-y-3 pt-3 border-t border-navy-700">
                  <MetricCell label="Nodes" value={job.nodes ?? '—'} tip={"Compute nodes allocated to this job\n分配給此工作的運算節點"} color="#8892b0" />
                  <MetricCell label="CPUs"  value={String(cpuCount)} tip={"CPU cores allocated or requested\n已分配或請求的 CPU 核心數"} color="#4299e1" />
                  <MetricCell
                    label="GPUs"
                    value={<span style={{ color: gpus !== '—' ? '#a78bfa' : '#4a5568' }}>{gpus}</span>}
                    tip={"GPUs allocated or requested via TRES/GRES\n透過 TRES/GRES 分配或請求的 GPU 數"}
                  />
                  <MetricCell
                    label="Wait"
                    value={dur(waitSecs)}
                    tip={waitSecs !== null ? `Queued for ${dur(waitSecs)} before resources were allocated\n等待 ${dur(waitSecs)} 後取得資源` : 'Job has not started yet\n工作尚未開始'}
                    color="#8892b0"
                  />
                  <MetricCell
                    label="Runtime"
                    value={
                      <span style={{ color: stateStr === 'RUNNING' ? '#00d4b0' : '#8892b0' }}>
                        {stateStr === 'RUNNING' && runSecs !== null ? `▶ ${dur(runSecs)}` : dur(runSecs)}
                      </span>
                    }
                    tip={stateStr === 'RUNNING'
                      ? `Running for ${dur(runSecs)} (updates every refresh)\n已執行 ${dur(runSecs)}（每次重新整理更新）`
                      : runSecs !== null ? `Total wall-clock duration: ${dur(runSecs)}\n總執行時間：${dur(runSecs)}` : 'Job has not started\n工作尚未開始'}
                  />
                  <MetricCell
                    label="Remaining"
                    value={
                      remainSecs !== null
                        ? <span style={{ color: remainSecs < 3600 ? '#e53e3e' : remainSecs < 14400 ? '#f6ad55' : '#68d391' }}>
                            {dur(remainSecs)}
                          </span>
                        : <span style={{ color: '#4a5568' }}>—</span>
                    }
                    tip={remainSecs !== null
                      ? `Job will be forcibly killed in ${dur(remainSecs)}\n工作將在 ${dur(remainSecs)} 後被強制終止`
                      : timeLimitInf ? 'No time limit set\n未設定時間限制' : 'Not applicable\n不適用'}
                  />
                  <MetricCell
                    label="Time Limit"
                    value={mins(timeLimit)}
                    tip={"Maximum wall-clock time — job is killed if it exceeds this\n最大實際執行時間，超過此限制工作將被終止"}
                    color="#8892b0"
                  />
                  <MetricCell
                    label="Submit Time"
                    value={<span className="text-xs">{ts(job.submit_time)}</span>}
                    tip={"Date and time this job was submitted to the queue\n此工作提交到佇列的日期與時間"}
                    color="#8892b0"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
