'use client'

import { useVideoStats } from '@/lib/hooks'

interface VideoStatsProps {
  videoId: string
}

export function VideoStats({ videoId }: VideoStatsProps) {
  const { data: stats, isLoading } = useVideoStats(videoId)

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading stats...</div>
  }

  if (!stats) {
    return null
  }

  return (
    <div className="flex gap-4 text-sm text-gray-600 mt-2">
      <div>
        <span className="font-semibold">{stats.viewsTotal.toLocaleString()}</span> views
      </div>
      <div className="text-gray-400">•</div>
      <div>
        <span className="font-semibold">{stats.viewsToday.toLocaleString()}</span> today
      </div>
      <div className="text-gray-400">•</div>
      <div>
        <span className="font-semibold">{stats.viewsMonth.toLocaleString()}</span> this month
      </div>
    </div>
  )
}
