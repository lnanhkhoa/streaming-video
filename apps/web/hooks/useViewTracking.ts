'use client'

import { useRef } from 'react'
import { useTrackView } from '@/lib/hooks'

export function useViewTracking(videoId: string) {
  const hasTracked = useRef(false)
  const { mutate: trackView } = useTrackView()

  const handleTrackView = () => {
    if (hasTracked.current) return

    try {
      trackView(videoId)
      hasTracked.current = true
      console.log('View tracked for video:', videoId)
    } catch (error) {
      console.error('Failed to track view:', error)
    }
  }

  return { trackView: handleTrackView }
}
