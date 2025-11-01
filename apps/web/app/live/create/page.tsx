'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCreateLiveStream } from '@/lib/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function CreateLivePage() {
  const router = useRouter()
  const { mutateAsync: createStream, isPending } = useCreateLiveStream()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Please enter a stream title')
      return
    }

    try {
      setError(null)

      const stream = await createStream({
        title: title.trim(),
        description: description.trim() || undefined,
      })

      // Redirect to streaming page
      router.push(`/live/stream/${stream.videoId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create stream')
    }
  }

  return (
    <main className="container mx-auto p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Create Live Stream</h1>
          <p className="text-gray-600">
            Set up your live stream and start broadcasting
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Stream Details</CardTitle>
            <CardDescription>
              Enter information about your live stream
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Title *</label>
              <Input
                type="text"
                placeholder="Enter stream title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isPending}
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter stream description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isPending}
                rows={4}
                maxLength={500}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <Button
              onClick={handleCreate}
              disabled={!title.trim() || isPending}
              className="w-full"
              size="lg"
            >
              {isPending ? 'Creating...' : 'Create & Start Setup'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
