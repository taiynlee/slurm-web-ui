interface GaugeChartProps {
  value: number        // 0–100
  color?: string
  bgColor?: string
  size?: number
  minLabel?: string
  maxLabel?: string
}

export function GaugeChart({
  value,
  color = '#00d4b0',
  bgColor = '#1e2a4a',
  size = 160,
  minLabel,
  maxLabel,
}: GaugeChartProps) {
  const cx = size / 2
  const cy = size * 0.58
  const r = size * 0.38
  const sw = size * 0.07  // stroke width

  // 0° = up (12 o'clock), clockwise positive
  const toXY = (deg: number) => {
    const rad = (deg * Math.PI) / 180
    return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) }
  }

  // arc from startDeg, sweeping sweepDeg clockwise
  const arcPath = (startDeg: number, sweepDeg: number) => {
    if (sweepDeg <= 0) return ''
    const end = toXY(startDeg + sweepDeg)
    const start = toXY(startDeg)
    const large = sweepDeg > 180 ? 1 : 0
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
  }

  const START = -135
  const TOTAL = 270
  const pct = Math.max(0, Math.min(100, value))
  const valueSweep = (pct / 100) * TOTAL

  const startPt = toXY(START)
  const endPt = toXY(START + TOTAL)

  return (
    <svg
      width={size}
      height={size * 0.78}
      viewBox={`0 0 ${size} ${size * 0.78}`}
    >
      {/* track */}
      <path
        d={arcPath(START, TOTAL)}
        fill="none"
        stroke={bgColor}
        strokeWidth={sw}
        strokeLinecap="round"
      />
      {/* value */}
      {valueSweep > 0 && (
        <path
          d={arcPath(START, valueSweep)}
          fill="none"
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      )}
      {/* center text */}
      <text
        x={cx}
        y={cy + sw * 0.4}
        textAnchor="middle"
        fill="white"
        fontSize={size * 0.2}
        fontWeight="700"
        fontFamily="inherit"
      >
        {pct.toFixed(0)}%
      </text>
      {/* min label */}
      {minLabel && (
        <text
          x={startPt.x}
          y={startPt.y + size * 0.07}
          textAnchor="middle"
          fill="#8892b0"
          fontSize={size * 0.1}
          fontFamily="inherit"
        >
          {minLabel}
        </text>
      )}
      {/* max label */}
      {maxLabel && (
        <text
          x={endPt.x}
          y={endPt.y + size * 0.07}
          textAnchor="middle"
          fill="#8892b0"
          fontSize={size * 0.1}
          fontFamily="inherit"
        >
          {maxLabel}
        </text>
      )}
    </svg>
  )
}
