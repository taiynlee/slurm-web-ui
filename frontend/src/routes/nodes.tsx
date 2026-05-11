import { useState } from 'react'
import { useApiData } from '../hooks/useCluster'
import { state0, mb2gb, cpuLoad, gpuTotal, gpuUsed, gpuModel } from '../lib/slurm'
import { Tooltip } from '../components/Tooltip'

const STATE_COLOR: Record<string, string> = {
  idle: '#00d4b0', allocated: '#4299e1', mixed: '#a78bfa',
  down: '#e53e3e', draining: '#f6ad55', drained: '#fc8181', completing: '#68d391',
}
const STATE_TIP: Record<string, string> = {
  idle:       'Node has no jobs assigned and is ready to accept new work\n節點無工作，可接受新工作',
  allocated:  'Node is fully allocated — all CPUs are assigned to running jobs\n節點已完全分配，所有 CPU 均在執行工作',
  mixed:      'Node has some CPUs allocated to jobs and some idle\n節點部分 CPU 分配中，部分閒置',
  down:       'Node is marked unavailable by the scheduler (failure or admin action)\n節點被排程器標記為不可用（故障或管理員操作）',
  draining:   'Node is finishing current jobs and will accept no new jobs\n節點正在完成現有工作，不再接受新工作',
  drained:    'Node has finished draining — idle but not accepting new jobs\n節點已完成排空，閒置但不接受新工作',
  completing: 'Node has jobs in the completing/cleanup phase\n節點有工作正在完成／清理階段',
}

function StateBadge({ state }: { state: string }) {
  const color = STATE_COLOR[state.toLowerCase()] ?? '#8892b0'
  const tip = STATE_TIP[state.toLowerCase()] ?? `Node state: ${state}`
  return (
    <Tooltip tip={tip}>
      <span
        className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize cursor-help"
        style={{ backgroundColor: color + '20', color }}
      >
        {state}
      </span>
    </Tooltip>
  )
}

function MiniBar({ value, total, color, tip }: { value: number; total: number; color: string; tip: string }) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0
  return (
    <Tooltip tip={tip}>
      <div className="flex items-center gap-2 cursor-help">
        <div className="w-20 h-1.5 bg-navy-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
        <span className="text-xs text-[#8892b0]">{value}/{total}</span>
      </div>
    </Tooltip>
  )
}

function MetricCell({ label, tip, children }: { label: string; tip: string; children: React.ReactNode }) {
  return (
    <div>
      <Tooltip tip={tip}>
        <p className="text-xs text-[#8892b0] mb-1 cursor-help">{label}</p>
      </Tooltip>
      {children}
    </div>
  )
}

export default function Nodes() {
  const { data, loading, error } = useApiData<any>('/cluster/nodes')
  const [search, setSearch] = useState('')
  const nodes: any[] = data?.nodes ?? (Array.isArray(data) ? data : [])

  const filtered = nodes.filter(node => {
    const name = String(node.name ?? '')
    return name.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Tooltip tip="Live status of all compute nodes registered in the Slurm cluster\nSlurm 叢集中所有運算節點的即時狀態">
            <h1 className="text-2xl font-bold text-white cursor-help">Cluster Nodes（叢集節點）</h1>
          </Tooltip>
          <p className="text-sm text-[#8892b0] mt-0.5">Live node status — refreshes every 1 min</p>
        </div>
        <div className="flex items-center gap-3">
          <Tooltip tip="Total number of compute nodes registered in this cluster\n此叢集中登記的運算節點總數">
            <span className="text-sm text-[#8892b0] cursor-help">{nodes.length} nodes</span>
          </Tooltip>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search node…"
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
        <div className="rounded-xl bg-navy-800 border border-navy-700 p-8 text-center text-[#8892b0]">
          No nodes found
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((node: any, i: number) => {
            const stateStr  = state0(node.state)
            const cpus      = node.cpus ?? 0
            const allocCpus = node.alloc_cpus ?? 0
            const gpuT      = gpuTotal(node.gres ?? '')
            const gpuU      = gpuUsed(node.tres_used ?? '')
            const model     = gpuModel(node.gres ?? '')
            const freeMem   = mb2gb(node.free_mem)
            const load      = cpuLoad(node.cpu_load, cpus)
            const parts     = Array.isArray(node.partitions)
              ? node.partitions.join(', ')
              : (node.partitions ?? '—')
            const feats     = Array.isArray(node.active_features)
              ? node.active_features.join(', ')
              : (node.features ?? '—')
            const gresUsed  = node.gres_used ?? '—'

            return (
              <div key={node.name ?? i} className="bg-navy-800 rounded-2xl border border-navy-700 p-4">
                {/* Header */}
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <Tooltip tip="Hostname of this compute node\n此運算節點的主機名稱">
                    <span className="font-mono font-bold text-white text-sm cursor-help">{node.name ?? '—'}</span>
                  </Tooltip>
                  <StateBadge state={stateStr} />
                  {parts !== '—' && (
                    <Tooltip tip="Slurm partitions this node belongs to\n此節點所屬的 Slurm 分區">
                      <span className="text-xs text-[#8892b0] cursor-help">{parts}</span>
                    </Tooltip>
                  )}
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-3 pt-3 border-t border-navy-700">
                  <MetricCell label="CPU Allocated" tip={`${allocCpus} of ${cpus} CPUs allocated to jobs (${cpus > 0 ? Math.round(allocCpus/cpus*100) : 0}% utilized)\n${cpus} 顆 CPU 中已分配 ${allocCpus} 顆給工作`}>
                    <MiniBar value={allocCpus} total={cpus} color="#4299e1"
                      tip={`${allocCpus} of ${cpus} CPUs allocated (${cpus > 0 ? Math.round(allocCpus/cpus*100) : 0}%)\n已分配 ${allocCpus}／${cpus} 顆 CPU`} />
                  </MetricCell>

                  <MetricCell label="CPU Load" tip="Instantaneous CPU load reported by Slurm — reflects actual CPU utilization on this node\nSlurm 回報的即時 CPU 負載，反映此節點的實際 CPU 使用情況">
                    <span className="text-sm font-semibold text-[#8892b0]">{load}</span>
                  </MetricCell>

                  <MetricCell label="Memory Free" tip="Free memory currently available on this node (not reserved by any job)\n此節點目前可用的空閒記憶體（未被任何工作保留）">
                    <span className="text-sm font-semibold text-[#68d391]">{freeMem}</span>
                  </MetricCell>

                  {model && (
                    <MetricCell label="GPU Model" tip={`GPU type as configured in Slurm GRES: ${model}\nSlurm GRES 設定的 GPU 型號：${model}`}>
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded border inline-block"
                        style={{ color: '#a78bfa', backgroundColor: '#a78bfa15', borderColor: '#a78bfa40' }}>
                        {model}
                      </span>
                    </MetricCell>
                  )}

                  {gpuT > 0 && (
                    <MetricCell label="GPU Allocated" tip={`${gpuU} of ${gpuT} GPUs allocated to jobs (${Math.round(gpuU/gpuT*100)}% utilized)\n${gpuT} 顆 GPU 中已分配 ${gpuU} 顆給工作`}>
                      <MiniBar value={gpuU} total={gpuT} color="#a78bfa"
                        tip={`${gpuU} of ${gpuT} GPUs allocated (${Math.round(gpuU/gpuT*100)}%)\n已分配 ${gpuU}／${gpuT} 顆 GPU`} />
                    </MetricCell>
                  )}

                  {gresUsed !== '—' && (
                    <MetricCell label="GRES Used" tip="Raw GRES usage string showing allocated GPU indices and counts\n顯示已分配 GPU 索引與數量的原始 GRES 使用字串">
                      <span className="text-xs text-[#8892b0] font-mono">{gresUsed}</span>
                    </MetricCell>
                  )}
                </div>

                {/* Features */}
                {feats !== '—' && (
                  <div className="mt-3 pt-3 border-t border-navy-700">
                    <Tooltip tip="Active node features used for --constraint matching when submitting jobs\n提交工作時用於 --constraint 篩選的節點功能標籤">
                      <p className="text-xs text-[#8892b0] mb-1 cursor-help">Features</p>
                    </Tooltip>
                    <p className="text-xs text-[#8892b0] font-mono">{feats}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
