'use client'

import { Badge } from '@/components/ui/badge'

interface LiveIndicatorProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

export function LiveIndicator({
  className = '',
  size = 'md',
  showText = true
}: LiveIndicatorProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5'
  }

  return (
    <Badge className={`bg-red-600 text-white animate-pulse ${sizeClasses[size]} ${className}`}>
      <span className="inline-block w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
      {showText && 'LIVE'}
    </Badge>
  )
}
