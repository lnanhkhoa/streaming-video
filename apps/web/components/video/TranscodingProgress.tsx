'use client'

import { useTranscodingProgress } from '@/hooks/useTranscodingProgress'
import { Progress } from '@/components/ui/progress'

interface TranscodingProgressProps {
  videoId: string
}

export function TranscodingProgress({ videoId }: TranscodingProgressProps) {
  const { data, isLoading, error } = useTranscodingProgress(videoId)

  if (isLoading) {
    return <div className="text-gray-500">Loading progress...</div>
  }

  if (error) {
    return <div className="text-red-600">Error loading progress: {error.message}</div>
  }

  if (!data) {
    return null
  }

  const { status, progress, startedAt, error: transcodeError } = data

  if (status === 'READY') {
    return <div className="text-green-600">✅ Transcoding complete!</div>
  }

  if (status === 'FAILED') {
    return (
      <div className="text-red-600">❌ Transcoding failed: {transcodeError || 'Unknown error'}</div>
    )
  }

  if (status === 'PROCESSING') {
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>🎬 Transcoding in progress...</span>
          <span className="font-semibold">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
        {startedAt && (
          <p className="text-xs text-gray-500">
            Started: {new Date(startedAt).toLocaleTimeString()}
          </p>
        )}
      </div>
    )
  }

  return <div className="text-gray-500">⏳ Waiting to process... (Status: {status})</div>
}
