import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import * as echarts from 'echarts'
import { Activity } from 'lucide-react'
import { useApiData } from '../hooks/useCluster'
import { api } from '../lib/api'
import { Tooltip } from '../components/Tooltip'

// ── colour palette shared with rest of the UI ────────────────────────────────
const GPU_COLORS = [
  '#a78bfa', '#4299e1', '#00d4b0', '#f6ad55',
  '#68d391', '#fc8181', '#e53e3e', '#ed8936',
]

const METRIC_OPTIONS = [
  { value: 'gpu_utilization',     label: 'GPU Utilization',  unit: '%', yMax: 100 },
  { value: 'gpu_mem_utilization', label: 'VRAM Utilization', unit: '%', yMax: 100 },
]

const RANGE_OPTIONS = [
  { value: 1,   label: '1h'  },
  { value: 6,   label: '6h'  },
  { value: 24,  label: '24h' },
  { value: 168, label: '7d'  },
]

// ── API types ────────────────────────────────────────────────────────────────
interface GpuSummary {
  total_gpus: number
  gpus_up: number
  total_util_pct: number
  total_mem_util_pct: number
  total_power_w: number
}

interface NodeStat {
  entity: string
  gpu_util: number | null
  mem_util: number | null
  temperature: number | null
  power_w: number | null
  cpu_alloc?: number | null
  cpu_total?: number | null
  mem_alloc_mb?: number | null
  mem_total_mb?: number | null
}

interface SlurmNode {
  name: string
  cpus: number
  alloc_cpus: number
  real_memory: number    // MB
  alloc_memory?: number  // MB
  free_memory?: number   // MB
}

interface HistoryResponse {
  entity: string
  metric: string
  hours: number
  series: Record<string, [number, number][]>
}

// ── small helpers ─────────────────────────────────────────────────────────────
function fmt(v: number | null, unit: string, decimals = 1) {
  if (v == null) return '—'
  return `${v.toFixed(decimals)}${unit}`
}

function fmtGB(mb: number | null | undefined): string {
  if (mb == null) return '—'
  return mb >= 1024 ? `${Math.round(mb / 1024)}G` : `${mb}M`
}

function MiniBar({ value, color }: { value: number | null; color: string }) {
  const pct = value ?? 0
  return (
    <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden mt-1">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
    </div>
  )
}

// ── Node grid ─────────────────────────────────────────────────────────────────
function NodeGrid({
  nodes,
  selected,
  onSelect,
}: {
  nodes: NodeStat[]
  selected: string
  onSelect: (e: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {nodes.map(n => {
        const isActive = n.entity === selected
        const util = n.gpu_util ?? 0
        const utilColor = util >= 80 ? '#e53e3e' : util >= 50 ? '#f6ad55' : '#00d4b0'
        const cpuPct = (n.cpu_total && n.cpu_alloc != null)
          ? Math.round((n.cpu_alloc / n.cpu_total) * 100) : null
        return (
          <button
            key={n.entity}
            onClick={() => onSelect(n.entity)}
            className={`text-left rounded-xl border p-3 transition-all w-[140px]  ${
              isActive
                ? 'border-[#a78bfa] bg-[#a78bfa15]'
                : 'border-navy-700 bg-navy-900 hover:border-[#a78bfa60]'
            }`}
          >
            <p className="text-xs font-mono font-semibold text-white truncate mb-2">{n.entity}</p>

            <div className="space-y-1.5">
              <div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#8892b0]">GPU</span>
                  <span style={{ color: utilColor }}>{fmt(n.gpu_util, '%', 0)}</span>
                </div>
                <MiniBar value={n.gpu_util} color={utilColor} />
              </div>
              <div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#8892b0]">VRAM</span>
                  <span className="text-[#4299e1]">{fmt(n.mem_util, '%', 0)}</span>
                </div>
                <MiniBar value={n.mem_util} color="#4299e1" />
              </div>
              {cpuPct !== null && (
                <div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#8892b0]">CPU</span>
                    <span className="text-[#68d391]">{n.cpu_alloc}/{n.cpu_total}</span>
                  </div>
                  <MiniBar value={cpuPct} color="#68d391" />
                </div>
              )}
              {n.mem_total_mb != null && (
                <div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#8892b0]">Memory</span>
                    <span className="text-[#ed8936]">
                      {fmtGB(n.mem_alloc_mb)}/{fmtGB(n.mem_total_mb)}
                    </span>
                  </div>
                  <MiniBar
                    value={n.mem_alloc_mb != null && n.mem_total_mb ? (n.mem_alloc_mb / n.mem_total_mb) * 100 : null}
                    color="#ed8936"
                  />
                </div>
              )}
              <div className="flex justify-between text-xs pt-0.5">
                <span className="text-[#8892b0]">Temp</span>
                <span className="text-white">{fmt(n.temperature, '°C', 0)}</span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── ECharts time-series chart ────────────────────────────────────────────────
function GpuChart({
  data,
  unit,
  yMax,
  loading,
  jobMap,
}: {
  data: Record<string, [number, number][]>
  unit: string
  yMax: number | null
  loading: boolean
  jobMap: Record<string, number>   // gpu index → job_id for selected node
}) {
  const ref = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!ref.current) return
    chart.current = echarts.init(ref.current, null, { renderer: 'canvas' })
    const onResize = () => chart.current?.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chart.current?.dispose()
    }
  }, [])

  useEffect(() => {
    if (!chart.current) return
    const keys = Object.keys(data).sort()

    if (keys.length === 0) {
      chart.current.setOption({ series: [], graphic: [{
        type: 'text', left: 'center', top: 'middle',
        style: { text: loading ? 'Loading…' : 'No data yet — collecting…', fill: '#8892b0', fontSize: 14 },
      }] }, true)
      return
    }

    const option: echarts.EChartsOption = {
      graphic: [],
      backgroundColor: 'transparent',
      animation: false,
      grid: { top: 36, right: 130, bottom: 32, left: 58 },
      xAxis: {
        type: 'time',
        axisLabel: { color: '#8892b0', fontSize: 11 },
        axisLine: { lineStyle: { color: '#2d3748' } },
        splitLine: { lineStyle: { color: '#2d3748', type: 'dashed' } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: yMax ?? undefined,
        axisLabel: { color: '#8892b0', fontSize: 11, formatter: `{value}${unit}` },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#2d3748', type: 'dashed' } },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1e2533',
        borderColor: '#2d3748',
        textStyle: { color: '#e2e8f0', fontSize: 12 },
        axisPointer: { lineStyle: { color: '#4a5568' } },
        valueFormatter: (v: unknown) => `${typeof v === 'number' ? v.toFixed(1) : '—'}${unit}`,
      },
      legend: {
        right: 8,
        top: 4,
        orient: 'vertical',
        textStyle: { color: '#ccd6f6', fontSize: 15, fontWeight: 500 },
        icon: 'circle',
        itemWidth: 12,
        itemHeight: 12,
      },
      dataZoom: [{ type: 'inside', throttle: 50 }],
      series: keys.map((k, i) => {
        const idx = k.replace('gpu', '')
        const jobId = jobMap[idx]
        const label = jobId ? `${k}  #${jobId}` : k
        const color = GPU_COLORS[i % GPU_COLORS.length]
        return {
          name: label,
          type: 'line',
          data: data[k],
          smooth: false,
          symbol: 'none',
          lineStyle: { width: 1.5, color },
          itemStyle: { color },
        }
      }),
    }
    chart.current.setOption(option, true)
  }, [data, unit, yMax, loading, jobMap])

  return <div ref={ref} style={{ height: 380 }} />
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GpuMonitoring() {
  const { data: summary, loading: sumLoading, error: sumError } =
    useApiData<GpuSummary>('/cluster/gpu/summary')

  const { data: nodes, loading: nodesLoading } =
    useApiData<NodeStat[]>('/cluster/gpu/nodes')

  const { data: slurmNodes } =
    useApiData<{ nodes: SlurmNode[] }>('/cluster/nodes', 60000)

  // node → { gpu_index → job_id }
  const { data: jobsData } =
    useApiData<Record<string, Record<string, number>>>('/cluster/gpu/jobs', 30000)

  // merge Slurm CPU+memory data into GPU node stats
  const nodesWithCpu = useMemo<NodeStat[]>(() => {
    const cpuMap: Record<string, SlurmNode> = {}
    for (const n of (slurmNodes?.nodes ?? [])) {
      cpuMap[n.name] = n
    }
    return (nodes ?? []).map(n => {
      const s = cpuMap[n.entity]
      const memAlloc = s
        ? (s.alloc_memory ?? (s.real_memory != null && s.free_memory != null ? s.real_memory - s.free_memory : null))
        : null
      return {
        ...n,
        cpu_alloc: s?.alloc_cpus ?? null,
        cpu_total: s?.cpus ?? null,
        mem_alloc_mb: memAlloc,
        mem_total_mb: s?.real_memory ?? null,
      }
    })
  }, [nodes, slurmNodes])

  const [selectedNode, setSelectedNode] = useState<string>('')
  const [metric, setMetric] = useState(METRIC_OPTIONS[0])
  const [hours, setHours] = useState(24)
  const [histData, setHistData] = useState<Record<string, [number, number][]>>({})
  const [histLoading, setHistLoading] = useState(false)

  // auto-select first node once node list arrives
  useEffect(() => {
    if (!selectedNode && nodes && nodes.length > 0) {
      setSelectedNode(nodes[0].entity)
    }
  }, [nodes, selectedNode])

  const fetchHistory = useCallback(async (entity: string, m: string, h: number) => {
    if (!entity) return
    setHistLoading(true)
    try {
      const r = await api.get<HistoryResponse>('/cluster/gpu/history', {
        params: { entity, metric: m, hours: h },
      })
      setHistData(r.data.series ?? {})
    } catch {
      setHistData({})
    } finally {
      setHistLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory(selectedNode, metric.value, hours)
    const id = setInterval(() => fetchHistory(selectedNode, metric.value, hours), 60_000)
    return () => clearInterval(id)
  }, [selectedNode, metric, hours, fetchHistory])

  const selectNode = (entity: string) => {
    setSelectedNode(entity)
  }

  if (sumLoading && nodesLoading) return (
    <div className="flex items-center justify-center py-24">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-400 border-t-transparent" />
    </div>
  )

  if (sumError) return (
    <div className="rounded-xl bg-[#2d1b1b] border border-[#e53e3e]/30 p-6 text-[#fc8181]">
      {sumError}
    </div>
  )

  const stats = summary ? [
    { label: 'GPU Online', tip: 'GPUs online vs total\n上線 GPU 數 vs 總數', value: summary.total_gpus != null ? `${summary.gpus_up ?? '—'} / ${summary.total_gpus}` : '—', color: '#00d4b0' },
    { label: 'GPU Utilization', tip: 'Cluster-wide GPU utilisation\n整體叢集 GPU 運算使用率', value: fmt(summary.total_util_pct, '%'), color: '#a78bfa' },
    { label: 'VRAM Utilization', tip: 'Cluster-wide GPU memory utilisation\n整體叢集 GPU 顯示記憶體使用率', value: fmt(summary.total_mem_util_pct, '%'), color: '#4299e1' },
    { label: 'Total Power', tip: 'Total GPU power draw\n所有節點 GPU 總耗電量', value: summary.total_power_w != null ? summary.total_power_w >= 1000 ? `${(summary.total_power_w / 1000).toFixed(1)} KW` : `${Math.round(summary.total_power_w)} W` : '—', color: '#f6ad55' },
  ] : []

  return (
    <div className="space-y-4">

      {/* Top card: 資訊區 + Node 選擇 */}
      <div className="bg-navy-800 rounded-2xl border border-navy-700 p-5">
        <div className="flex items-stretch gap-6">

          {/* Left: 資訊區 */}
          <div className="shrink-0">
            <p className="text-xs uppercase tracking-widest text-[#8892b0] mb-3">GPU Information</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {stats.map(s => (
                <Tooltip key={s.label} tip={s.tip}>
                  <div className="cursor-help">
                    <p className="text-xs text-[#8892b0] mb-0.5">{s.label}</p>
                    <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                  </div>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="w-px bg-navy-700 self-stretch" />

          {/* Right: Node 選擇 */}
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-widest text-[#8892b0] mb-3">Node Selection</p>
            {nodesWithCpu.length > 0
              ? <NodeGrid nodes={nodesWithCpu} selected={selectedNode} onSelect={selectNode} />
              : <p className="text-sm text-[#8892b0]">{nodesLoading ? 'Loading…' : 'No GPU node data yet'}</p>
            }
          </div>
        </div>
      </div>

      {/* Time series chart */}
      <div className="bg-navy-800 rounded-2xl border border-navy-700 p-5">

        {/* Chart header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#a78bfa] shrink-0" />
            <span className="text-sm font-semibold text-white">GPU Metrics History</span>
            {selectedNode && (
              <span className="px-2 py-0.5 rounded-full text-xs font-mono border bg-[#a78bfa15] text-[#a78bfa] border-[#a78bfa40]">
                {selectedNode}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Metric selector */}
            <div className="flex rounded-lg overflow-hidden border border-navy-700 text-xs">
              {METRIC_OPTIONS.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMetric(m)}
                  className={`px-3 py-1.5 transition-colors ${
                    metric.value === m.value
                      ? 'bg-[#a78bfa] text-white'
                      : 'text-[#8892b0] hover:text-white hover:bg-navy-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Time range selector */}
            <div className="flex rounded-lg overflow-hidden border border-navy-700 text-xs">
              {RANGE_OPTIONS.map(r => (
                <button
                  key={r.value}
                  onClick={() => setHours(r.value)}
                  className={`px-3 py-1.5 transition-colors ${
                    hours === r.value
                      ? 'bg-navy-700 text-white'
                      : 'text-[#8892b0] hover:text-white hover:bg-navy-700'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <GpuChart
          data={histData}
          unit={metric.unit}
          yMax={metric.yMax}
          loading={histLoading}
          jobMap={jobsData?.[selectedNode] ?? {}}
        />
      </div>

    </div>
  )
}
