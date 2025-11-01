import { geistMono } from '@/ui/fonts'
import '@/styles/globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistMono.className} antialiased`}>{children}</body>
    </html>
  )
}
