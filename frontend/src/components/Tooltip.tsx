import type { ReactNode } from 'react'

interface TooltipProps {
  tip: string
  children: ReactNode
  className?: string
}

export function Tooltip({ tip, children, className }: TooltipProps) {
  return (
    <span className={`relative group inline-block ${className ?? ''}`}>
      {children}
      <span className="absolute z-50 bottom-full left-0 mb-1.5 px-2.5 py-1.5 bg-[#0a1628] border border-[#1e3a5f] rounded-lg text-xs text-[#b8c4d4] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-xl whitespace-pre-line max-w-[280px] leading-snug">
        {tip}
      </span>
    </span>
  )
}
