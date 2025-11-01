'use client'

import { useState, useRef, useEffect } from 'react'

interface UseLiveStreamOptions {
  onStreamReady?: (stream: MediaStream) => void
  onError?: (error: Error) => void
}

export function useLiveStream({ onStreamReady, onError }: UseLiveStreamOptions = {}) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(true)
  const [isMicOn, setIsMicOn] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Request camera and microphone access
  const requestMediaAccess = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'user', // Front camera for selfie mode
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      streamRef.current = mediaStream
      setStream(mediaStream)
      onStreamReady?.(mediaStream)
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access camera/microphone'
      setError(errorMessage)
      onError?.(new Error(errorMessage))
    }
  }

  // Stop stream and release devices
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
      setStream(null)
      setIsStreaming(false)
    }
  }

  // Toggle camera on/off
  const toggleCamera = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsCameraOn(videoTrack.enabled)
      }
    }
  }

  // Toggle microphone on/off
  const toggleMic = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMicOn(audioTrack.enabled)
      }
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream()
    }
  }, [])

  return {
    stream,
    isStreaming,
    isCameraOn,
    isMicOn,
    error,
    requestMediaAccess,
    stopStream,
    toggleCamera,
    toggleMic,
    setIsStreaming,
  }
}
