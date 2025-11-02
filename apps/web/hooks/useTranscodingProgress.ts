import { useEffect, useState } from 'react'
import { rpcClient } from '@/lib/api-rpc'

interface TranscodingProgress {
  videoId: string
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'LIVE'
  progress: number
  startedAt: string | null
  estimatedEnd: string | null
  error: string | null
  duration: number | null
}

export function useTranscodingProgress(videoId: string) {
  const [data, setData] = useState<TranscodingProgress | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!videoId) return

    let intervalId: NodeJS.Timeout | null = null

    const fetchProgress = async () => {
      try {
        const res = await rpcClient.api.videos[':id'].progress.$get({ param: { id: videoId } })

        if (!res.ok) {
          throw new Error(`API error: ${res.statusText}`)
        }

        const json = await res.json()
        const progressData = json.data
        setData(progressData)
        setError(null)

        // Stop polling if done
        if (progressData.status === 'READY' || progressData.status === 'FAILED') {
          if (intervalId) clearInterval(intervalId)
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        setIsLoading(false)
      }
    }

    fetchProgress()

    // Poll every 2 seconds while processing
    intervalId = setInterval(fetchProgress, 2000)

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [videoId])

  return { data, isLoading, error }
}
