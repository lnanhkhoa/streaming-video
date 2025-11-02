'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { videoAPI, liveAPI, uploadAPI, analyticsAPI } from './api-rpc'
import { AllowedVideoTypes } from '@repo/constants'

// Query keys
export const queryKeys = {
  videos: ['videos'] as const,
  videoList: (liveOnly?: boolean) => [...queryKeys.videos, 'list', liveOnly] as const,
  video: (id: string) => [...queryKeys.videos, id] as const,
  videoStats: (id: string) => [...queryKeys.videos, id, 'stats'] as const,
  live: ['live'] as const,
  upload: ['upload'] as const
}

// Video queries
export function useVideos(liveOnly?: boolean) {
  return useQuery({
    queryKey: queryKeys.videoList(liveOnly),
    queryFn: async () => {
      const result = await videoAPI.listVideos(liveOnly ? { liveOnly } : undefined)
      return result.videos
    },
    staleTime: 30 * 1000 // 30 seconds
  })
}

export function useVideo(id: string) {
  return useQuery({
    queryKey: queryKeys.video(id),
    queryFn: () => videoAPI.getVideo(id),
    staleTime: 1 * 60 * 1000 // 1 minute
  })
}

export function useVideoStats(id: string) {
  return useQuery({
    queryKey: queryKeys.videoStats(id),
    queryFn: () => analyticsAPI.getStats(id),
    staleTime: 10 * 1000 // 10 seconds
  })
}

export function useTrackView() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (videoId: string) => analyticsAPI.trackView(videoId),
    onSuccess: (_, videoId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.videoStats(videoId) })
    }
  })
}

// Live streaming mutations
export function useCreateLiveStream() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { title: string; description?: string }) => liveAPI.createLiveStream(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.videos })
    }
  })
}

export function useStartLiveStream() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (videoId: string) => liveAPI.startLiveStream(videoId),
    onSuccess: (_, videoId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.video(videoId) })
    }
  })
}

export function useStopLiveStream() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (videoId: string) => liveAPI.stopLiveStream(videoId),
    onSuccess: (_, videoId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.video(videoId) })
    }
  })
}

// Upload mutations
export function useGetPresignedUrl() {
  return useMutation({
    mutationFn: (data: { fileName: string; fileSize: number; contentType: AllowedVideoTypes }) =>
      uploadAPI.getPresignedUrl(data)
  })
}

export function useCompleteUpload() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      videoId,
      data
    }: {
      videoId: string
      data: { key: string; title: string; description?: string }
    }) => uploadAPI.completeUpload(videoId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.videos })
    }
  })
}
