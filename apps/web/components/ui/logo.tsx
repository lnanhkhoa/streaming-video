import Link from 'next/link'
import { Video } from 'lucide-react'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

export function Logo({ size = 'md', showText = true }: LogoProps) {
  const sizeClasses = {
    sm: { icon: 'w-6 h-6', text: 'text-lg' },
    md: { icon: 'w-8 h-8', text: 'text-xl' },
    lg: { icon: 'w-10 h-10', text: 'text-2xl' }
  }

  return (
    <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
      <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-1.5">
        <Video className={`${sizeClasses[size].icon} text-white`} />
      </div>
      {showText && (
        <span
          className={`font-bold ${sizeClasses[size].text} bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent`}
        >
          StreamVid
        </span>
      )}
    </Link>
  )
}
