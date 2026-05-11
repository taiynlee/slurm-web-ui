import { useApiData } from '../hooks/useCluster'
import { GaugeChart } from '../components/GaugeChart'
import { Tooltip } from '../components/Tooltip'
import { state0, n, dur } from '../lib/slurm'

const JOB_COLORS: Record<string, string> = {
  RUNNING: '#00d4b0', PENDING: '#4299e1', COMPLETED: '#68d391',
  FAILED: '#e53e3e', CANCELLED: '#a0aec0', TIMEOUT: '#f6ad55',
}
const NODE_COLORS: Record<string, string> = {
  idle: '#00d4b0', allocated: '#4299e1', mixed: '#a78bfa',
  down: '#e53e3e', draining: '#f6ad55', drained: '#fc8181', completing: '#68d391',
}

const JOB_STATE_TIPS: Record<string, string> = {
  RUNNING:   'Jobs actively executing on compute nodes\n工作正在運算節點上執行中',
  PENDING:   'Jobs waiting in the queue for available resources\n工作正在佇列中等待可用資源',
  COMPLETED: 'Jobs that finished successfully with exit code 0\n工作已成功完成（結束碼 0）',
  FAILED:    'Jobs that exited with a non-zero exit code\n工作以非零結束碼退出',
  CANCELLED: 'Jobs cancelled by a user or system administrator\n工作被使用者或管理員取消',
  TIMEOUT:   'Jobs that were killed after exceeding their time limit\n工作超過時間限制而被終止',
  UNKNOWN:   'Jobs whose state could not be determined — usually transient during scheduler restart or state transitions\n無法確定狀態的工作，通常是排程器重啟或狀態轉換時的短暫情況',
  COMPLETING:'Jobs that have finished execution and are cleaning up before marking as COMPLETED\n工作已完成執行，正在清理中，尚未標記為 COMPLETED',
  BOOT_FAIL: 'Jobs that failed because the allocated node(s) could not boot\n因分配的節點無法開機而失敗的工作',
  NODE_FAIL: 'Jobs that failed due to a compute node failure during execution\n因運算節點在執行期間故障而失敗的工作',
  PREEMPTED: 'Jobs that were stopped to allow a higher-priority job to run\n工作被暫停以讓優先權較高的工作先執行',
  SUSPENDED: 'Jobs that have been suspended — resources are freed but the job is not cancelled\n工作已暫停，資源已釋放但工作未取消',
  RESIZING:  'Jobs in the process of requesting a change in resource allocation\n工作正在請求變更資源配置',
  REVOKED:   'Sibling jobs that were revoked in a federation\n在聯邦中被撤銷的相關工作',
  SIGNALING: 'Jobs that are being sent a signal\n工作正在接收訊號',
  SPECIAL_EXIT: 'Jobs that exited with a special exit code requesting requeue\n工作以特殊結束碼退出並請求重新排隊',
  STAGE_OUT: 'Jobs that are staging out data after completing\n工作完成後正在進行資料搬出',
  STOPPED:   'Jobs that were stopped with SIGSTOP — CPUs are retained but not executing\n工作被 SIGSTOP 停止，CPU 保留但未執行',
}
const NODE_STATE_TIPS: Record<string, string> = {
  idle:       'Node has no jobs assigned — all CPUs are free and ready to accept new work\n節點無工作，所有 CPU 閒置，可接受新工作',
  allocated:  'Node is fully allocated — every CPU is assigned to a running job\n節點已完全分配，每顆 CPU 都在執行工作',
  mixed:      'Node is partially allocated — some CPUs are running jobs while others are idle. This is normal when a job uses fewer CPUs than the node has.\n節點部分分配，部分 CPU 執行工作，部分閒置，這在工作使用 CPU 少於節點總數時屬正常現象',
  down:       'Node is unavailable — marked down by the scheduler due to failure or admin action\n節點不可用，因故障或管理員操作被排程器標記為 down',
  draining:   'Node is being drained — not accepting new jobs but finishing jobs already running\n節點正在排空，不接受新工作，但仍完成現有工作',
  drained:    'Node has finished draining — no jobs are running, but it is still not accepting new jobs until an admin brings it back up\n節點已完成排空，無工作執行，但需管理員恢復才能接受新工作',
  completing: 'Node has jobs in the completing/cleanup phase after they finished executing\n節點有工作處於完成／清理階段',
  future:     'Node is defined but not yet active in the cluster\n節點已定義但尚未在叢集中啟用',
  unknown:    'Node state is not known — may have just come online or lost contact with the controller\n節點狀態未知，可能剛上線或與控制器失去聯繫',
}


function Card({ title, titleTip, children }: { title: string; titleTip?: string; children: React.ReactNode }) {
  return (
    <div className="bg-navy-800 rounded-2xl border border-navy-700 p-5">
      <p className="text-xs uppercase tracking-widest text-[#8892b0] mb-4">
        {titleTip ? (
          <Tooltip tip={titleTip}>
            <span className="cursor-help">{title}</span>
          </Tooltip>
        ) : title}
      </p>
      {children}
    </div>
  )
}

interface ClusterInfo {
  controller_health: Record<string, any>
  node_count: number
  partition_count: number
  job_count: number
  jobs_by_state: Record<string, number>
  node_states: Record<string, number>
  total_gpus: number
  used_gpus: number
  scheduler: Record<string, any>
}

export function ClusterOverview() {
  const { data, loading, error } = useApiData<ClusterInfo>('/cluster/info')
  const { data: jobsData } = useApiData<any>('/cluster/jobs')
  const { data: nodesData } = useApiData<any>('/cluster/nodes')

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-400 border-t-transparent" />
    </div>
  )

  if (error || !data) return (
    <div className="rounded-xl bg-[#2d1b1b] border border-[#e53e3e]/30 p-6 text-[#fc8181]">
      {error ?? 'Failed to load cluster data'}
    </div>
  )

  const ns = data.node_states ?? {}
  const js = data.jobs_by_state ?? {}
  const sc = data.scheduler ?? {}
  const pings: any[] = data.controller_health?.pings ?? []
  const primary = pings.find(p => p.primary)
  const backup  = pings.find(p => !p.primary)

  const downNodes  = Object.entries(ns).filter(([s]) => /down|drain|error|fail/i.test(s)).reduce((a,[,c])=>a+c,0)
  const allocNodes = Object.entries(ns).filter(([s]) => /alloc|mixed|complet/i.test(s)).reduce((a,[,c])=>a+c,0)
  const upNodes    = data.node_count - downNodes
  const healthPct  = data.node_count > 0 ? Math.round((upNodes / data.node_count) * 100) : 0
  const utilPct    = upNodes > 0 ? Math.round((allocNodes / upNodes) * 100) : 0
  const gpuPct     = data.total_gpus > 0 ? Math.round((data.used_gpus / data.total_gpus) * 100) : 0

  const primaryUp = primary?.pinged === 'UP'
  const backupUp  = !backup || backup.pinged === 'UP'
  const utilColor  = '#4299e1'
  const gpuColor   = '#a78bfa'
  const gaugeColor = (!primaryUp || healthPct < 50)
    ? '#e53e3e'
    : (!backupUp || healthPct < 80)
      ? '#f6ad55'
      : '#00d4b0'
  const gaugeTip = !primaryUp
    ? `主控制器無回應 — 叢集無法接受新工作。${downNodes} 個節點 down。`
    : healthPct < 50
      ? `節點健康率 ${healthPct}%，低於 50%。`
      : !backupUp
        ? `節點健康率 ${healthPct}%，備援控制器無回應 — 叢集僅靠主控制器運作，無容錯能力。`
        : healthPct < 80
          ? `節點健康率 ${healthPct}%，介於 50–79%。`
          : `節點健康率 ${healthPct}%，主／備援控制器皆正常。`

  const maxJs = Math.max(...Object.values(js), 1)
  const maxNs = Math.max(...Object.values(ns), 1)

  // Group full job objects by state for inline display
  const allJobs: any[] = jobsData?.jobs ?? (Array.isArray(jobsData) ? jobsData : [])
  const jobsByState: Record<string, any[]> = {}
  for (const job of allJobs) {
    const s = state0(job.job_state ?? job.state).toUpperCase()
    if (!jobsByState[s]) jobsByState[s] = []
    jobsByState[s].push(job)
  }

  // Group full node objects by state
  const allNodes: any[] = nodesData?.nodes ?? (Array.isArray(nodesData) ? nodesData : [])
  const nodesByState: Record<string, any[]> = {}
  for (const node of allNodes) {
    const s = state0(node.state).toLowerCase()
    if (!nodesByState[s]) nodesByState[s] = []
    nodesByState[s].push(node)
  }

  const nowTs = Math.floor(Date.now() / 1000)

  return (
    <div className="space-y-4">

      {/* Row 1 — 3 or 4 gauges / metric cards */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${data.total_gpus > 0 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>

        {/* Cluster Health */}
        <div className="bg-navy-800 rounded-2xl border border-navy-700 p-5 flex flex-col items-center">
          <Tooltip tip="Node health percentage plus controller status. Amber = backup controller down; Red = primary down or nodes unhealthy\n節點健康百分比加上控制器狀態。琥珀色 = 備援控制器 down；紅色 = 主控制器 down 或節點不健康">
            <p className="text-xs uppercase tracking-widest text-[#8892b0] mb-1 cursor-help whitespace-nowrap">Slurm Cluster Health（叢集健康）</p>
          </Tooltip>
          <Tooltip tip={gaugeTip} className="w-full flex justify-center">
            <span>
              <GaugeChart value={healthPct} color={gaugeColor} minLabel="0%" maxLabel="100%" />
            </span>
          </Tooltip>
          <div className="mt-2 space-y-1 w-full text-sm">
            <div className="flex justify-between gap-2">
              <Tooltip tip={`Primary Slurm controller: ${primary?.hostname ?? 'unknown'}\n主 Slurm 控制器：${primary?.hostname ?? '未知'}`}>
                <span className="text-[#8892b0] cursor-help truncate">
                  Primary{primary?.hostname ? ` (${primary.hostname})` : ''}
                </span>
              </Tooltip>
              <span className={`shrink-0 font-semibold ${primaryUp ? 'text-teal-400' : 'text-[#e53e3e]'}`}>{primary?.pinged ?? '—'}</span>
            </div>
            <div className="flex justify-between gap-2">
              <Tooltip tip={backup ? `Backup Slurm controller: ${backup.hostname}\n備援 Slurm 控制器：${backup.hostname}` : 'No backup controller configured\n未設定備援控制器'}>
                <span className="text-[#8892b0] cursor-help truncate">
                  Backup{backup?.hostname ? ` (${backup.hostname})` : ''}
                </span>
              </Tooltip>
              <span className={`shrink-0 font-semibold ${backupUp ? 'text-teal-400' : 'text-[#e53e3e]'}`}>{backup?.pinged ?? '—'}</span>
            </div>
          </div>
        </div>

        {/* Node Utilization */}
        <div className="bg-navy-800 rounded-2xl border border-navy-700 p-5 flex flex-col items-center">
          <Tooltip tip="Percentage of healthy nodes currently running at least one job\n健康節點中目前正在執行至少一個工作的比例">
            <p className="text-xs uppercase tracking-widest text-[#8892b0] mb-1 cursor-help">Node Utilization（節點使用率）</p>
          </Tooltip>
          <Tooltip tip={`${allocNodes} of ${upNodes} healthy nodes are allocated to jobs\n${upNodes} 個健康節點中有 ${allocNodes} 個已分配工作`} className="w-full flex justify-center">
            <span>
              <GaugeChart value={utilPct} color={utilColor} minLabel="0%" maxLabel="100%" />
            </span>
          </Tooltip>
          <div className="mt-2 space-y-1 w-full text-sm">
            <div className="flex justify-between">
              <Tooltip tip="Nodes with at least one active job (allocated or mixed state)\n有至少一個執行中工作的節點（allocated 或 mixed 狀態）">
                <span className="text-[#8892b0] cursor-help">Allocated</span>
              </Tooltip>
              <span className="font-semibold" style={{ color: utilColor }}>{allocNodes} / {upNodes}</span>
            </div>
            <div className="flex justify-between">
              <Tooltip tip="Nodes unavailable due to failure, maintenance, or admin action\n因故障、維護或管理員操作而不可用的節點">
                <span className="text-[#8892b0] cursor-help">Down</span>
              </Tooltip>
              <span className={downNodes > 0 ? 'text-[#e53e3e] font-semibold' : 'text-white'}>{downNodes}</span>
            </div>
          </div>
        </div>

        {/* GPU Utilization — hidden when cluster has no GPUs */}
        {data.total_gpus > 0 && <div className="bg-navy-800 rounded-2xl border border-navy-700 p-5 flex flex-col items-center">
          <Tooltip tip="Percentage of total cluster GPUs currently allocated to running jobs\n叢集 GPU 總數中目前分配給執行中工作的比例">
            <p className="text-xs uppercase tracking-widest text-[#8892b0] mb-1 cursor-help">GPU Utilization（GPU 使用率）</p>
          </Tooltip>
          <Tooltip tip={`${data.used_gpus} of ${data.total_gpus} GPUs are allocated to jobs\n${data.total_gpus} 顆 GPU 中有 ${data.used_gpus} 顆已分配給工作`} className="w-full flex justify-center">
            <span>
              <GaugeChart value={gpuPct} color={gpuColor} minLabel="0%" maxLabel="100%" />
            </span>
          </Tooltip>
          <div className="mt-2 space-y-1 w-full text-sm">
            <div className="flex justify-between">
              <Tooltip tip="GPUs currently allocated to running jobs across all nodes\n所有節點中目前分配給執行中工作的 GPU 數">
                <span className="text-[#8892b0] cursor-help">Used</span>
              </Tooltip>
              <span className="font-semibold" style={{ color: gpuColor }}>{data.used_gpus} / {data.total_gpus}</span>
            </div>
            <div className="flex justify-between">
              <Tooltip tip="GPUs available for new job allocations\n可供新工作分配的空閒 GPU 數">
                <span className="text-[#8892b0] cursor-help">Free</span>
              </Tooltip>
              <span className="text-white">{data.total_gpus - data.used_gpus}</span>
            </div>
          </div>
        </div>}

        {/* Live job counts */}
        <div className="bg-navy-800 rounded-2xl border border-navy-700 p-5">
          <Tooltip tip="Job counts derived from the current job queue — same source as the Jobs by State chart\n從目前工作佇列統計的工作數量，與工作狀態圖表資料來源相同">
            <p className="text-xs uppercase tracking-widest text-[#8892b0] mb-4 cursor-help">Live Jobs（即時工作）</p>
          </Tooltip>
          <div className="space-y-4">
            <div>
              <Tooltip tip="Jobs actively executing on compute nodes right now\n目前正在運算節點上執行的工作">
                <p className="text-3xl font-bold text-teal-400 cursor-help">{js.RUNNING ?? 0}</p>
              </Tooltip>
              <p className="text-sm text-[#8892b0]">Running</p>
            </div>
            <div>
              <Tooltip tip="Jobs waiting in the queue for sufficient resources to become available\n在佇列中等待足夠資源的工作">
                <p className="text-3xl font-bold text-[#4299e1] cursor-help">{js.PENDING ?? 0}</p>
              </Tooltip>
              <p className="text-sm text-[#8892b0]">Pending</p>
            </div>
            <div>
              <Tooltip tip="Jobs currently in the queue with a FAILED exit status\n佇列中目前狀態為 FAILED 的工作">
                <p className={`text-3xl font-bold cursor-help ${(js.FAILED ?? 0) > 0 ? 'text-[#e53e3e]' : 'text-white'}`}>{js.FAILED ?? 0}</p>
              </Tooltip>
              <p className="text-sm text-[#8892b0]">Failed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2 — bars + summary + scheduler */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <Card title="Jobs by State（工作狀態）" titleTip="Distribution of all jobs in the system grouped by their current execution state\n系統中所有工作依目前執行狀態分組的分布">
          <div className="space-y-4">
            {Object.entries(js).sort(([,a],[,b])=>b-a).map(([s, c]) => {
              const color = JOB_COLORS[s] ?? '#8892b0'
              const tip   = JOB_STATE_TIPS[s] ?? s
              const jobs  = jobsByState[s] ?? []
              return (
                <div key={s}>
                  {/* bar row */}
                  <div className="flex justify-between text-sm mb-1">
                    <Tooltip tip={tip}>
                      <span className="text-[#8892b0] capitalize cursor-help">{s}</span>
                    </Tooltip>
                    <Tooltip tip={`${c} ${s.toLowerCase()} job${c !== 1 ? 's' : ''}`}>
                      <span className="font-semibold cursor-help" style={{ color }}>{c}</span>
                    </Tooltip>
                  </div>
                  <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden mb-2">
                    <div className="h-full rounded-full" style={{ width: `${(c / maxJs) * 100}%`, backgroundColor: color }} />
                  </div>
                  {/* job detail list */}
                  {jobs.length > 0 && (
                    <div className="space-y-1 pl-1">
                      {jobs.slice(0, 5).map((job: any) => {
                        const jobId   = job.job_id ?? job.id
                        const name    = job.name ?? '—'
                        const startTs = n(job.start_time)
                        const endTs   = n(job.end_time)
                        const runSecs = startTs
                          ? s === 'RUNNING' ? nowTs - startTs : (endTs ? endTs - startTs : null)
                          : null
                        return (
                          <div key={jobId} className="flex items-center justify-between gap-2 text-xs">
                            <Tooltip tip={`Job ID: ${jobId}`}>
                              <span className="text-[#8892b0] font-mono cursor-help shrink-0">#{jobId}</span>
                            </Tooltip>
                            <span className="text-white truncate flex-1">{name}</span>
                            {runSecs !== null && (
                              <Tooltip tip={s === 'RUNNING' ? `Running for ${dur(runSecs)}` : `Total runtime: ${dur(runSecs)}`}>
                                <span className="shrink-0 cursor-help" style={{ color }}>{dur(runSecs)}</span>
                              </Tooltip>
                            )}
                          </div>
                        )
                      })}
                      {jobs.length > 5 && (
                        <p className="text-xs text-[#4a5568] pl-1">+{jobs.length - 5} more</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {Object.keys(js).length === 0 && <p className="text-sm text-[#8892b0]">No jobs</p>}
          </div>
        </Card>

        <Card title="GPU Node Status（GPU 節點狀態）" titleTip="Distribution of all cluster nodes grouped by their current operational state\n叢集所有節點依目前運作狀態分組的分布">
          <div className="space-y-4">
            {Object.entries(ns).sort(([,a],[,b])=>b-a).map(([s, c]) => {
              const color = NODE_COLORS[s] ?? '#8892b0'
              const tip   = NODE_STATE_TIPS[s] ?? s
              const nodes = nodesByState[s] ?? []
              return (
                <div key={s}>
                  <div className="flex justify-between text-sm mb-1">
                    <Tooltip tip={tip}>
                      <span className="text-[#8892b0] capitalize cursor-help">{s}</span>
                    </Tooltip>
                    <Tooltip tip={`${c} ${s} node${c !== 1 ? 's' : ''}`}>
                      <span className="font-semibold cursor-help" style={{ color }}>{c}</span>
                    </Tooltip>
                  </div>
                  <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden mb-2">
                    <div className="h-full rounded-full" style={{ width: `${(c / maxNs) * 100}%`, backgroundColor: color }} />
                  </div>
                  {nodes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {nodes.map((node: any) => (
                        <Tooltip
                          key={node.name}
                          tip={`${node.name} — ${node.alloc_cpus ?? 0}/${node.cpus ?? 0} CPUs allocated`}
                        >
                          <span
                            className="inline-block px-2 py-0.5 rounded-md text-xs font-mono font-semibold cursor-help border"
                            style={{ backgroundColor: color + '15', color, borderColor: color + '40' }}
                          >
                            {node.name}
                          </span>
                        </Tooltip>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {Object.keys(ns).length === 0 && <p className="text-sm text-[#8892b0]">No node data</p>}
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Scheduler Stats（排程統計）" titleTip="Internal Slurm scheduler performance and throughput metrics\nSlurm 排程器內部效能與吞吐量指標">
            <div className="space-y-2">
              {[
                ['Submitted (session)', sc.jobs_submitted ?? 0, '#8892b0', 'Total jobs submitted since the Slurm daemon last started\nSlurm daemon 上次啟動後提交的工作總數'],
                ['Completed',           sc.jobs_completed ?? 0, '#68d391', 'Jobs that finished successfully in this session\n本次 session 中成功完成的工作數'],
                ['Sched cycle (avg)',   `${sc.schedule_cycle_mean ?? 0} ms`, '#4299e1', 'Average time in milliseconds for the scheduler to complete one decision cycle\n排程器完成一次決策循環的平均時間（毫秒）'],
                ['Backfill cycle',      `${sc.bf_cycle_last ?? 0} ms`, '#a78bfa', 'Time in milliseconds for the last backfill scheduling pass\n上一次回填排程所花費的時間（毫秒）'],
                ['Server threads',      sc.server_thread_count ?? 0, '#8892b0', 'Number of active threads inside the Slurm daemon process\nSlurm daemon 內部目前活躍的執行緒數'],
              ].map(([label, val, color, tip]) => (
                <div key={String(label)} className="flex justify-between text-sm">
                  <Tooltip tip={String(tip)}>
                    <span className="text-[#8892b0] cursor-help">{label}</span>
                  </Tooltip>
                  <span className="font-semibold" style={{ color: String(color) }}>{val}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Cluster Summary（叢集總覽）" titleTip="High-level resource counts for the entire cluster\n整個叢集的高階資源數量概覽">
            <div className="space-y-2">
              {[
                ['Total Nodes',   data.node_count,      '#00d4b0', 'Total number of compute nodes registered in the cluster\n叢集中登記的運算節點總數'],
                ['Partitions',    data.partition_count, '#4299e1', 'Number of Slurm partitions (job queues) configured\n已設定的 Slurm 分區（工作佇列）數量'],
                ['Total GPUs',    data.total_gpus,      '#a78bfa', 'Total number of GPUs across all compute nodes\n所有運算節點的 GPU 總數'],
                ['Total Jobs',    data.job_count,       '#f6ad55', 'Total number of jobs currently tracked by the scheduler\n排程器目前追蹤的工作總數'],
              ].map(([label, val, color, tip]) => (
                <div key={String(label)} className="flex justify-between text-sm">
                  <Tooltip tip={String(tip)}>
                    <span className="text-[#8892b0] cursor-help">{label}</span>
                  </Tooltip>
                  <span className="text-lg font-bold" style={{ color: String(color) }}>{val}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

    </div>
  )
}
