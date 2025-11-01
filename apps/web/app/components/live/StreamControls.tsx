'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Video, VideoOff, Mic, MicOff, StopCircle } from 'lucide-react'

interface StreamControlsProps {
  isStreaming: boolean
  isCameraOn: boolean
  isMicOn: boolean
  onStartStream: () => void
  onStopStream: () => void
  onToggleCamera: () => void
  onToggleMic: () => void
  disabled?: boolean
}

export function StreamControls({
  isStreaming,
  isCameraOn,
  isMicOn,
  onStartStream,
  onStopStream,
  onToggleCamera,
  onToggleMic,
  disabled = false,
}: StreamControlsProps) {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Stream Controls</h3>

        {/* Media controls */}
        <div className="flex gap-3">
          <Button
            variant={isCameraOn ? 'default' : 'destructive'}
            size="lg"
            onClick={onToggleCamera}
            disabled={disabled}
            className="flex-1"
          >
            {isCameraOn ? (
              <>
                <Video className="w-5 h-5 mr-2" />
                Camera On
              </>
            ) : (
              <>
                <VideoOff className="w-5 h-5 mr-2" />
                Camera Off
              </>
            )}
          </Button>

          <Button
            variant={isMicOn ? 'default' : 'destructive'}
            size="lg"
            onClick={onToggleMic}
            disabled={disabled}
            className="flex-1"
          >
            {isMicOn ? (
              <>
                <Mic className="w-5 h-5 mr-2" />
                Mic On
              </>
            ) : (
              <>
                <MicOff className="w-5 h-5 mr-2" />
                Mic Off
              </>
            )}
          </Button>
        </div>

        {/* Stream start/stop */}
        <div>
          {!isStreaming ? (
            <Button
              onClick={onStartStream}
              disabled={disabled}
              size="lg"
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              Start Streaming
            </Button>
          ) : (
            <Button
              onClick={onStopStream}
              disabled={disabled}
              size="lg"
              variant="destructive"
              className="w-full"
            >
              <StopCircle className="w-5 h-5 mr-2" />
              Stop Streaming
            </Button>
          )}
        </div>

        {/* Status info */}
        <div className="pt-4 border-t text-sm text-gray-600 space-y-1">
          <p>
            <span className="font-medium">Status:</span>{' '}
            {isStreaming ? (
              <span className="text-red-600 font-semibold">🔴 Live</span>
            ) : (
              <span>Ready to stream</span>
            )}
          </p>
          <p>
            <span className="font-medium">Camera:</span>{' '}
            {isCameraOn ? 'On' : 'Off'}
          </p>
          <p>
            <span className="font-medium">Microphone:</span>{' '}
            {isMicOn ? 'On' : 'Off'}
          </p>
        </div>
      </div>
    </Card>
  )
}
