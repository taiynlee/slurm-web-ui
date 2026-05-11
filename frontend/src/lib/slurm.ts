/** Extract numeric value from Slurm {set, infinite, number} wrapper */
export function n(v: any): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return v
  if (typeof v === 'object' && 'number' in v) {
    if (!v.set) return null
    if (v.infinite) return null   // caller can check separately
    return v.number as number
  }
  return null
}

/** Returns true when Slurm value is "infinite" */
export function isInf(v: any): boolean {
  if (typeof v === 'object' && v !== null) return v.infinite === true
  return false
}

/** First element of Slurm state array, or the value itself */
export function state0(v: any): string {
  if (Array.isArray(v)) return String(v[0] ?? '—')
  return String(v ?? '—')
}

/** MB → "X.X GB" */
export function mb2gb(v: any): string {
  const val = n(v)
  if (val === null) return '—'
  return `${(val / 1024).toFixed(1)} GB`
}

/** Unix timestamp → locale string */
export function ts(v: any): string {
  const val = n(v)
  if (!val) return '—'
  try { return new Date(val * 1000).toLocaleString() } catch { return '—' }
}

/** Minutes → "Xh Ym" or "∞" */
export function mins(v: any): string {
  if (isInf(v)) return '∞'
  const val = n(v)
  if (val === null) return '—'
  if (val >= 60) return `${Math.floor(val / 60)}h ${val % 60}m`
  return `${val}m`
}

/** CPU load (Slurm reports as N*100) → "X.X%" */
export function cpuLoad(v: any, totalCpus: number): string {
  const val = n(v)
  if (val === null || !totalCpus) return '—'
  return `${(val / 100).toFixed(1)}%`
}

/** Parse total GPU count from gres string "gpu:nvidia:8(S:0-1)" or "gpu:8" → 8 */
export function gpuTotal(gres: string): number {
  const m = gres?.match(/gpu(?::[a-zA-Z_0-9]+)?:(\d+)/i)
  return m ? parseInt(m[1], 10) : 0
}

/** Extract GPU model name from gres string "gpu:nvidia:8(S:0-1)" → "nvidia", "gpu:8" → null */
export function gpuModel(gres: string): string | null {
  const m = gres?.match(/gpu:([a-zA-Z][a-zA-Z0-9_]*):\d+/i)
  return m ? m[1] : null
}

/** Parse used GPU count from tres_used "cpu=2,gres/gpu=8" → 8 */
export function gpuUsed(tres: string): number {
  const m = tres?.match(/gres\/gpu=(\d+)/i)
  return m ? parseInt(m[1], 10) : 0
}

/** Format a duration in seconds → "Xd Xh Xm Xs" */
export function dur(seconds: number | null): string {
  if (seconds === null || seconds < 0) return '—'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/** Parse tres string "cpu=448,mem=3715048M,node=2,billing=448,gres/gpu=16" */
export function parseTres(tres: string): Record<string, string> {
  const result: Record<string, string> = {}
  if (!tres) return result
  for (const part of tres.split(',')) {
    const [k, v] = part.split('=')
    if (k && v !== undefined) result[k.trim()] = v.trim()
  }
  return result
}
