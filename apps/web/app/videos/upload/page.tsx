import { UploadForm } from '@/components/video/UploadForm'

export default function UploadPage() {
  return (
    <main className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Upload Video</h1>
        <p className="text-gray-600">
          Upload your video to make it available for streaming
        </p>
      </div>

      <UploadForm />
    </main>
  )
}
