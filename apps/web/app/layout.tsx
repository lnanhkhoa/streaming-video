import type { Metadata } from 'next'
import { geistMono } from '@/ui/fonts'
import '@/styles/globals.css'
import { Providers } from './providers'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: 'StreamVid - Video Streaming Platform',
  description: 'Stream and share your videos with the world. Live streaming and video hosting made simple.',
  keywords: ['video', 'streaming', 'live', 'HLS', 'upload'],
  authors: [{ name: 'StreamVid Team' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://streamvid.com',
    siteName: 'StreamVid',
    title: 'StreamVid - Video Streaming Platform',
    description: 'Stream and share your videos with the world',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistMono.className} antialiased`}>
        <Providers>
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  )
}
