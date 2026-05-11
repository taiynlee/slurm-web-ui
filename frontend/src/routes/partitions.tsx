import { useApiData } from '../hooks/useCluster'
import { n, isInf, parseTres, state0, gpuModel } from '../lib/slurm'
import { Tooltip } from '../components/Tooltip'

function StateBadge({ state }: { state: any }) {
  const s = state0(state)
  const up = /up|active/i.test(s)
  const color = up ? '#00d4b0' : '#e53e3e'
  const tip = up
    ? 'Partition is active and accepting job submissions\n分區運作正常，可接受工作提交'
    : 'Partition is inactive — jobs cannot be submitted to this partition\n分區已停用，無法提交工作到此分區'
  return (
    <Tooltip tip={tip}>
      <span
        className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize cursor-help"
        style={{ backgroundColor: color + '20', color }}
      >
        {s}
      </span>
    </Tooltip>
  )
}

function timeVal(obj: any): string {
  if (!obj) return '—'
  if (isInf(obj)) return '∞'
  const v = n(obj)
  if (v === null) return '—'
  if (v >= 60) return `${Math.floor(v / 60)}h ${v % 60}m`
  return `${v}m`
}

const NODE_STATE_COLOR: Record<string, string> = {
  idle: '#00d4b0', allocated: '#4299e1', mixed: '#a78bfa',
  down: '#e53e3e', draining: '#f6ad55', drained: '#fc8181', completing: '#68d391',
}

export default function Partitions() {
  const { data: partData, loading: partLoading, error: partError } = useApiData<any>('/cluster/partitions')
  const { data: nodeData } = useApiData<any>('/cluster/nodes')

  const partitions: any[] = partData?.partitions ?? (Array.isArray(partData) ? partData : [])
  const allNodes: any[] = nodeData?.nodes ?? (Array.isArray(nodeData) ? nodeData : [])

  // Group nodes by partition name
  const nodesByPartition: Record<string, any[]> = {}
  for (const node of allNodes) {
    const parts: string[] = Array.isArray(node.partitions)
      ? node.partitions
      : node.partitions ? [String(node.partitions)] : []
    for (const p of parts) {
      if (!nodesByPartition[p]) nodesByPartition[p] = []
      nodesByPartition[p].push(node)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Tooltip tip="Slurm partitions are job queues with distinct resource limits, node memberships, and scheduling policies\nSlurm 分區是具有各自資源限制、節點成員與排程策略的工作佇列">
            <h1 className="text-2xl font-bold text-white cursor-help">Partitions（分區）</h1>
          </Tooltip>
          <p className="text-sm text-[#8892b0] mt-0.5">Slurm partition configuration — refreshes every 1 min</p>
        </div>
        <Tooltip tip="Total number of partitions configured in this Slurm cluster\n此 Slurm 叢集中已設定的分區總數">
          <span className="text-sm text-[#8892b0] cursor-help">{partitions.length} partitions</span>
        </Tooltip>
      </div>

      {partLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-400 border-t-transparent" />
        </div>
      ) : partError ? (
        <div className="rounded-xl bg-[#2d1b1b] border border-[#e53e3e]/30 p-5 text-[#fc8181]">{partError}</div>
      ) : partitions.length === 0 ? (
        <div className="rounded-xl bg-navy-800 border border-navy-700 p-8 text-center text-[#8892b0]">No partition data</div>
      ) : (
        <div className="space-y-4">
          {partitions.map((p: any, i: number) => {
            const name     = p.name ?? p.PartitionName ?? '—'
            const state    = p.partition?.state ?? p.state ?? '—'
            const nodes    = p.nodes ?? {}
            const cpus     = p.cpus ?? {}
            const tres     = parseTres(p.tres?.configured ?? '')
            const maxTime  = p.maximums?.time
            const defTime  = p.defaults?.time
            const qos      = p.qos?.assigned || p.qos?.allowed || null
            const priority = p.priority
            const isDefault = p.defaults?.job === 'YES' || p.flags?.default === true
            const partNodes = nodesByPartition[name] ?? []

            const gpuCount = tres['gres/gpu'] ?? tres['gpu'] ?? null
            const gpuModels = [...new Set(partNodes.map(nd => gpuModel(nd.gres ?? '')).filter(Boolean))]
            const gpuModelStr = gpuModels.length > 0 ? gpuModels.join(', ') : null
            const memRaw   = tres['mem']
            const memGB    = memRaw
              ? parseFloat(memRaw) > 1024 ? `${(parseFloat(memRaw) / 1024).toFixed(0)} GB` : memRaw
              : null

            return (
              <div key={name ?? i} className="bg-navy-800 rounded-2xl border border-navy-700 p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Tooltip tip={`Partition name — submit jobs here with: sbatch --partition=${name}\n分區名稱，提交工作指令：sbatch --partition=${name}`}>
                      <h2 className="text-lg font-bold text-white cursor-help">{name}</h2>
                    </Tooltip>
                    <StateBadge state={state} />
                    {isDefault && (
                      <Tooltip tip="This is the default partition — jobs submitted without --partition will be sent here\n此為預設分區，未指定 --partition 的工作會提交到這裡">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-400/20 text-teal-400 cursor-help">Default</span>
                      </Tooltip>
                    )}
                  </div>
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                  <div>
                    <Tooltip tip="Total number of compute nodes in this partition\n此分區的運算節點總數">
                      <p className="text-xs text-[#8892b0] mb-1 cursor-help">Nodes</p>
                    </Tooltip>
                    <p className="text-sm font-semibold text-white">{nodes.total ?? (partNodes.length || '—')}</p>
                  </div>
                  <div>
                    <Tooltip tip="Total CPU cores available across all nodes in this partition (from TRES)\n此分區所有節點的 CPU 核心總數（來自 TRES）">
                      <p className="text-xs text-[#8892b0] mb-1 cursor-help">Total CPUs</p>
                    </Tooltip>
                    <p className="text-sm font-semibold text-[#4299e1]">{cpus.total ?? tres['cpu'] ?? '—'}</p>
                  </div>
                  {gpuCount && (
                    <div>
                      <Tooltip tip="Total GPUs available in this partition (from TRES configured)\n此分區可用的 GPU 總數（來自 TRES 設定）">
                        <p className="text-xs text-[#8892b0] mb-1 cursor-help">Total GPUs</p>
                      </Tooltip>
                      <p className="text-sm font-semibold text-[#a78bfa]">{gpuCount}</p>
                    </div>
                  )}
                  {gpuModelStr && (
                    <div>
                      <Tooltip tip="GPU model / type as configured in Slurm GRES across nodes in this partition\n此分區各節點 Slurm GRES 設定中的 GPU 型號／類型">
                        <p className="text-xs text-[#8892b0] mb-1 cursor-help">GPU Model</p>
                      </Tooltip>
                      <p className="text-sm font-semibold text-[#a78bfa] font-mono">{gpuModelStr}</p>
                    </div>
                  )}
                  {memGB && (
                    <div>
                      <Tooltip tip="Total memory across all nodes in this partition (from TRES configured)\n此分區所有節點的記憶體總量（來自 TRES 設定）">
                        <p className="text-xs text-[#8892b0] mb-1 cursor-help">Total Memory</p>
                      </Tooltip>
                      <p className="text-sm font-semibold text-[#68d391]">{memGB}</p>
                    </div>
                  )}
                  <div>
                    <Tooltip tip={`Maximum wall-clock time a job in this partition is allowed to run. ${isInf(maxTime) ? 'No limit enforced.' : ''}\n此分區工作允許執行的最大實際時間。${isInf(maxTime) ? '無限制。' : ''}`}>
                      <p className="text-xs text-[#8892b0] mb-1 cursor-help">Max Time</p>
                    </Tooltip>
                    <p className="text-sm font-semibold text-white">{timeVal(maxTime)}</p>
                  </div>
                  <div>
                    <Tooltip tip={`Default time limit applied to jobs submitted without an explicit --time argument. ${isInf(defTime) ? 'Defaults to unlimited.' : ''}\n未指定 --time 參數時套用的預設時間限制。${isInf(defTime) ? '預設無限制。' : ''}`}>
                      <p className="text-xs text-[#8892b0] mb-1 cursor-help">Default Time</p>
                    </Tooltip>
                    <p className="text-sm font-semibold text-white">{timeVal(defTime)}</p>
                  </div>
                  {qos && (
                    <div>
                      <Tooltip tip="Quality of Service policy assigned to this partition — controls priority, limits, and preemption\n分配給此分區的服務品質策略，控制優先權、限制與搶佔行為">
                        <p className="text-xs text-[#8892b0] mb-1 cursor-help">QOS</p>
                      </Tooltip>
                      <p className="text-sm font-semibold text-white">{qos}</p>
                    </div>
                  )}
                  {priority && (
                    <div>
                      <Tooltip tip="Job factor and tier used by the Slurm priority plugin to rank jobs in this partition\nSlurm 優先權插件用來排序此分區工作的係數與層級">
                        <p className="text-xs text-[#8892b0] mb-1 cursor-help">Priority</p>
                      </Tooltip>
                      <p className="text-sm font-semibold text-white">{priority.job_factor ?? priority.tier ?? '—'}</p>
                    </div>
                  )}
                </div>

                {/* Node list */}
                {partNodes.length > 0 && (
                  <div className="pt-3 border-t border-navy-700">
                    <Tooltip tip="Compute nodes that belong to this partition — these nodes run jobs submitted to this queue\n屬於此分區的運算節點，這些節點執行提交到此佇列的工作">
                      <p className="text-xs text-[#8892b0] mb-2 cursor-help">Nodes in this partition</p>
                    </Tooltip>
                    <div className="flex flex-wrap gap-2">
                      {partNodes.map((node: any) => {
                        const stateKey = state0(node.state).toLowerCase()
                        const color = NODE_STATE_COLOR[stateKey] ?? '#8892b0'
                        const allocCpus = node.alloc_cpus ?? 0
                        const totalCpus = node.cpus ?? 0
                        const nodeGpuModel = gpuModel(node.gres ?? '')
                        const nodeGpuTotal = node.gres ? node.gres.match(/gpu(?::[a-zA-Z_0-9]+)?:(\d+)/i)?.[1] : null
                        const gpuInfo = nodeGpuModel && nodeGpuTotal ? `, GPU: ${nodeGpuModel}×${nodeGpuTotal}` : ''
                        return (
                          <Tooltip
                            key={node.name}
                            tip={`${node.name} — state: ${stateKey}, CPUs: ${allocCpus}/${totalCpus} allocated${gpuInfo}\n狀態：${stateKey}，CPU：${allocCpus}/${totalCpus} 已分配${gpuInfo}`}
                          >
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border cursor-help"
                              style={{ backgroundColor: color + '15', color, borderColor: color + '40' }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                              {node.name}
                            </span>
                          </Tooltip>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* TRES configured */}
                {p.tres?.configured && (
                  <div className="mt-3 pt-3 border-t border-navy-700">
                    <Tooltip tip="Trackable Resources (TRES) configured for this partition — defines total billable resources including CPUs, memory, and GPUs\n此分區設定的可追蹤資源（TRES），定義包含 CPU、記憶體及 GPU 的可計費資源總量">
                      <p className="text-xs text-[#8892b0] mb-1 cursor-help">TRES Configured</p>
                    </Tooltip>
                    <p className="text-xs font-mono text-[#8892b0]">{p.tres.configured}</p>
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
