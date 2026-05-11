import { Link, useParams } from '@tanstack/react-router'
import { useApiData } from '../../hooks/useCluster'
import { Tooltip } from '../../components/Tooltip'

interface JobDetail {
  job_id: number
  name?: string
  state?: string | string[]
  state_reason?: string
  description?: string
  user?: string
  uid?: number
  group?: string
  gid?: number
  account?: string
  qos?: string
  partition?: string
  priority?: any
  nice?: any
  nodes?: string
  node_count?: any
  cpus?: any
  tasks?: any
  cpus_per_task?: any
  mem_per_cpu_mb?: any
  mem_per_node_mb?: any
  tres_req?: any
  tres_alloc?: any
  gres?: string
  licenses?: string
  submit_time?: any
  eligible_time?: any
  start_time?: any
  end_time?: any
  time_limit_min?: any
  deadline?: any
  work_dir?: string
  command?: string
  stdout?: string
  stdout_expanded?: string
  stderr?: string
  stderr_expanded?: string
  stdin_expanded?: string
  exit_code?: any
  derived_exit_code?: any
  restarts?: any
  dependency?: string
  comment?: string
}

const STATE_COLOR: Record<string, string> = {
  RUNNING:   '#00d4b0',
  PENDING:   '#4299e1',
  COMPLETED: '#68d391',
  FAILED:    '#e53e3e',
  CANCELLED: '#a0aec0',
  TIMEOUT:   '#f6ad55',
}

function formatTime(val?: any): string {
  if (!val) return 'N/A'
  const ts = typeof val === 'object' ? val?.number : Number(val)
  if (!ts || ts === 0) return 'N/A'
  try { return new Date(ts * 1000).toLocaleString() } catch { return String(val) }
}

function numVal(val?: any): string {
  if (val === null || val === undefined) return 'N/A'
  if (typeof val === 'object') return val?.number != null ? String(val.number) : 'N/A'
  return String(val)
}

const FIELD_TIPS: Record<string, string> = {
  'Job ID':          'Unique numeric identifier assigned to this job by Slurm\nSlurm 分配給此工作的唯一數字識別碼',
  'Name':            'Job name as specified at submission (--job-name)\n提交時指定的工作名稱（--job-name）',
  'State':           'Current execution state of the job\n工作目前的執行狀態',
  'Reason':          'Reason the job is in its current state (e.g., why it is pending)\n工作處於目前狀態的原因（例如：為何等待中）',
  'User':            'Username of the account that owns this job\n提交此工作的使用者帳號',
  'Account':         'Slurm account charged for this job\'s resource usage\n此工作資源使用計費的 Slurm 帳號',
  'Partition':       'Slurm partition (queue) this job was submitted to\n此工作提交的 Slurm 分區（佇列）',
  'QOS':             'Quality of Service policy applied to this job\n套用於此工作的服務品質策略',
  'Priority':        'Scheduling priority — higher values are scheduled first\n排程優先權，數值越高越優先排程',
  'Description':     'Optional free-text description provided at job submission\n提交工作時填寫的可選描述文字',
  'Nodes':           'Hostnames of compute nodes allocated to this job\n分配給此工作的運算節點主機名稱',
  'Node Count':      'Number of compute nodes allocated to this job\n分配給此工作的運算節點數量',
  'CPUs':            'Total CPU cores allocated to this job\n分配給此工作的 CPU 核心總數',
  'Tasks':           'Number of parallel tasks (MPI ranks) for this job\n此工作的平行任務數（MPI rank 數）',
  'CPUs / Task':     'CPUs allocated per task (--cpus-per-task)\n每個任務分配的 CPU 數（--cpus-per-task）',
  'Mem / CPU MB':    'Memory in MB requested per CPU core\n每個 CPU 核心請求的記憶體（MB）',
  'Mem / Node MB':   'Memory in MB requested per compute node\n每個運算節點請求的記憶體（MB）',
  'GRES':            'Generic Resources requested (e.g., GPU type and count)\n請求的通用資源（例如：GPU 類型與數量）',
  'TRES Req':        'Trackable Resources requested (CPUs, memory, GPUs, billing)\n請求的可追蹤資源（CPU、記憶體、GPU、計費）',
  'TRES Alloc':      'Trackable Resources actually allocated to this job\n實際分配給此工作的可追蹤資源',
  'Submit Time':     'Date and time when this job was submitted to the queue\n此工作提交到佇列的日期與時間',
  'Eligible Time':   'Earliest time this job became eligible for scheduling\n此工作最早可被排程的時間',
  'Start Time':      'Date and time when this job started executing\n此工作開始執行的日期與時間',
  'End Time':        'Date and time when this job finished or was killed\n此工作結束或被終止的日期與時間',
  'Time Limit':      'Maximum wall-clock time this job is allowed to run\n此工作允許執行的最大實際時間',
  'Deadline':        'Hard deadline by which this job must start, if set\n此工作必須開始執行的截止時間（若有設定）',
  'Working Dir':     'Working directory on the compute node during job execution\n工作執行期間在運算節點上的工作目錄',
  'Command':         'Full command or script path submitted for execution\n提交執行的完整指令或腳本路徑',
  'Stdout':          'Path where standard output from the job is written\n工作標準輸出寫入的檔案路徑',
  'Stderr':          'Path where standard error from the job is written\n工作標準錯誤寫入的檔案路徑',
  'Exit Code':       'Exit code returned by the job script (0 = success)\n工作腳本回傳的結束碼（0 = 成功）',
  'Derived Exit Code': 'Highest exit code across all job steps\n所有工作步驟中最高的結束碼',
  'Restarts':        'Number of times this job has been restarted\n此工作被重新啟動的次數',
  'Dependency':      'Job dependency expression — this job waits for other jobs\n工作相依性表達式，此工作需等待其他工作完成',
  'Comment':         'Admin or user comment attached to this job\n管理者或使用者附加在此工作的備註',
}

function Section({ title, titleTip, children }: { title: string; titleTip?: string; children: React.ReactNode }) {
  return (
    <div className="bg-navy-800 rounded-2xl border border-navy-700 overflow-hidden">
      <div className="px-6 py-3 border-b border-navy-700 bg-navy-700/50">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8892b0]">
          {titleTip ? (
            <Tooltip tip={titleTip}>
              <span className="cursor-help">{title}</span>
            </Tooltip>
          ) : title}
        </h2>
      </div>
      <div className="p-6">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">{children}</dl>
      </div>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value?: any; mono?: boolean }) {
  const display = value === null || value === undefined || value === '' ? 'N/A' : String(value)
  const tip = FIELD_TIPS[label]
  return (
    <div>
      <dt className="text-xs text-[#8892b0] uppercase tracking-wide mb-0.5">
        {tip ? (
          <Tooltip tip={tip}>
            <span className="cursor-help">{label}</span>
          </Tooltip>
        ) : label}
      </dt>
      <dd className={`text-sm text-white break-all ${mono ? 'font-mono' : ''}`}>{display}</dd>
    </div>
  )
}

export default function JobDetailPage() {
  const { jobId } = useParams({ from: '/_authenticated/jobs/$jobId' })
  const { data, loading, error } = useApiData<JobDetail>(`/cluster/jobs/${jobId}`, 15000)

  const stateStr = data?.state
    ? Array.isArray(data.state) ? data.state[0] : String(data.state)
    : undefined
  const stateColor = stateStr ? (STATE_COLOR[stateStr.toUpperCase()] ?? '#8892b0') : '#8892b0'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-400 border-t-transparent" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link to="/jobs" className="inline-flex items-center gap-1 text-sm text-[#8892b0] hover:text-white">
          ← Back to Jobs
        </Link>
        <div className="rounded-xl bg-[#2d1b1b] border border-[#e53e3e]/30 p-5 text-[#fc8181]">
          {error ?? 'Job not found'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/jobs" className="text-sm text-[#8892b0] hover:text-white transition-colors">
          ← Jobs
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Job {data.job_id}</h1>
          {stateStr && (
            <span
              className="px-3 py-0.5 rounded-full text-sm font-semibold"
              style={{ backgroundColor: stateColor + '20', color: stateColor }}
            >
              {stateStr}
            </span>
          )}
        </div>
      </div>

      <Section title="Summary（摘要）" titleTip="Core identity and ownership information for this job">
        <Field label="Job ID"      value={data.job_id} />
        <Field label="Name"        value={data.name} />
        <Field label="State"       value={stateStr} />
        <Field label="Reason"      value={data.state_reason} />
        <Field label="User"        value={data.user} />
        <Field label="Account"     value={data.account} />
        <Field label="Partition"   value={data.partition} />
        <Field label="QOS"         value={data.qos} />
        <Field label="Priority"    value={numVal(data.priority)} />
        <Field label="Description" value={data.description} />
      </Section>

      <Section title="Resources（資源配置）" titleTip="CPU, memory, GPU, and node resources allocated to this job">
        <Field label="Nodes"         value={data.nodes} />
        <Field label="Node Count"    value={numVal(data.node_count)} />
        <Field label="CPUs"          value={numVal(data.cpus)} />
        <Field label="Tasks"         value={numVal(data.tasks)} />
        <Field label="CPUs / Task"   value={numVal(data.cpus_per_task)} />
        <Field label="Mem / CPU MB"  value={numVal(data.mem_per_cpu_mb)} />
        <Field label="Mem / Node MB" value={numVal(data.mem_per_node_mb)} />
        <Field label="GRES"          value={data.gres} />
        <Field label="TRES Req"      value={typeof data.tres_req === 'object' ? JSON.stringify(data.tres_req) : data.tres_req} />
        <Field label="TRES Alloc"    value={typeof data.tres_alloc === 'object' ? JSON.stringify(data.tres_alloc) : data.tres_alloc} />
      </Section>

      <Section title="Timing（時間資訊）" titleTip="Submission, scheduling, and execution timestamps for this job">
        <Field label="Submit Time"   value={formatTime(data.submit_time)} />
        <Field label="Eligible Time" value={formatTime(data.eligible_time)} />
        <Field label="Start Time"    value={formatTime(data.start_time)} />
        <Field label="End Time"      value={formatTime(data.end_time)} />
        <Field label="Time Limit"    value={numVal(data.time_limit_min) !== 'N/A' ? `${numVal(data.time_limit_min)} min` : 'N/A'} />
        <Field label="Deadline"      value={formatTime(data.deadline)} />
      </Section>

      <Section title="I/O Paths（輸入輸出路徑）" titleTip="Filesystem paths for the job's working directory, script, and output files">
        <Field label="Working Dir" value={data.work_dir}          mono />
        <Field label="Command"     value={data.command}           mono />
        <Field label="Stdout"      value={data.stdout}            mono />
        <Field label="Stderr"      value={data.stderr}            mono />
      </Section>

      <Section title="Exit & Extras（結束與其他）" titleTip="Exit codes, restart count, dependencies, and comments for this job">
        <Field label="Exit Code"         value={numVal(data.exit_code)} />
        <Field label="Derived Exit Code" value={numVal(data.derived_exit_code)} />
        <Field label="Restarts"          value={numVal(data.restarts)} />
        <Field label="Dependency"        value={data.dependency} />
        <Field label="Comment"           value={data.comment} />
      </Section>
    </div>
  )
}
