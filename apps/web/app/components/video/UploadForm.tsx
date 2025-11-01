'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useGetPresignedUrl, useCompleteUpload } from '@/lib/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'error'

export function UploadForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { mutateAsync: getPresignedUrl } = useGetPresignedUrl()
  const { mutateAsync: completeUpload } = useCompleteUpload()

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setError('Please select a valid video file')
      return
    }

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024 // 500MB
    if (file.size > maxSize) {
      setError('File size must be less than 500MB')
      return
    }

    setSelectedFile(file)
    setError(null)

    // Auto-fill title from filename if empty
    if (!title) {
      const name = file.name.replace(/\.[^/.]+$/, '') // Remove extension
      setTitle(name)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !title.trim()) {
      setError('Please select a file and enter a title')
      return
    }

    try {
      setStatus('uploading')
      setError(null)
      setUploadProgress(0)

      // 1. Get presigned upload URL from API
      const { videoId, uploadUrl, key } = await getPresignedUrl({
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        contentType: selectedFile.type,
      })

      // 2. Upload file directly to MinIO
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100)
          setUploadProgress(progress)
        }
      })

      xhr.addEventListener('load', async () => {
        if (xhr.status === 200) {
          try {
            setStatus('processing')

            // 3. Notify API that upload is complete
            const { video } = await completeUpload({
              videoId,
              data: {
                key,
                title: title.trim(),
                description: description.trim() || undefined,
              },
            })

            setStatus('completed')

            // 4. Redirect to video page
            setTimeout(() => {
              router.push(`/videos/${video.id}`)
            }, 1500)
          } catch (err) {
            setStatus('error')
            setError(err instanceof Error ? err.message : 'Failed to process upload')
          }
        } else {
          setStatus('error')
          setError(`Upload failed: ${xhr.statusText}`)
        }
      })

      xhr.addEventListener('error', () => {
        setStatus('error')
        setError('Upload failed due to network error')
      })

      xhr.open('PUT', uploadUrl)
      xhr.setRequestHeader('Content-Type', selectedFile.type)
      xhr.send(selectedFile)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setTitle('')
    setDescription('')
    setUploadProgress(0)
    setStatus('idle')
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const isUploading = status === 'uploading'
  const isProcessing = status === 'processing'
  const isCompleted = status === 'completed'
  const isDisabled = isUploading || isProcessing || isCompleted

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Upload Video</CardTitle>
        <CardDescription>
          Upload a video file to be processed and made available for streaming
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* File Input */}
        <div>
          <label className="block text-sm font-medium mb-2">Video File</label>
          <Input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            disabled={isDisabled}
          />
          {selectedFile && (
            <p className="text-sm text-gray-600 mt-1">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        {/* Title Input */}
        <div>
          <label className="block text-sm font-medium mb-2">Title *</label>
          <Input
            type="text"
            placeholder="Enter video title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isDisabled}
            maxLength={100}
          />
        </div>

        {/* Description Input */}
        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter video description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isDisabled}
            rows={4}
            maxLength={500}
          />
        </div>

        {/* Upload Progress */}
        {(isUploading || isProcessing || isCompleted) && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {isUploading && 'Uploading...'}
                {isProcessing && 'Processing video...'}
                {isCompleted && '✅ Upload complete!'}
              </span>
              {isUploading && <span>{uploadProgress}%</span>}
            </div>
            <Progress value={isUploading ? uploadProgress : 100} />
            {isProcessing && (
              <p className="text-sm text-gray-600">
                Your video is being processed. This may take a few minutes.
              </p>
            )}
            {isCompleted && (
              <p className="text-sm text-green-600">
                Redirecting to video page...
              </p>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || !title.trim() || isDisabled}
            className="flex-1"
          >
            {isUploading && 'Uploading...'}
            {isProcessing && 'Processing...'}
            {isCompleted && 'Completed'}
            {status === 'idle' && 'Upload Video'}
            {status === 'error' && 'Retry Upload'}
          </Button>

          {status === 'error' && (
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>
          )}
        </div>

        {/* File Requirements */}
        <div className="pt-4 border-t">
          <p className="text-sm text-gray-600 font-medium mb-2">Requirements:</p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Supported formats: MP4, MOV, AVI, MKV, WebM</li>
            <li>• Maximum file size: 500MB</li>
            <li>• Video will be transcoded to HLS format</li>
            <li>• Processing time: 2-10 minutes depending on video length</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
