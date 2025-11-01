'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { Video, Upload, Radio } from 'lucide-react'

export function Header() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(path)
  }

  const navItems = [
    { href: '/', label: 'Videos', icon: Video },
    { href: '/live', label: 'Live', icon: Radio },
  ]

  const actionButtons = [
    { href: '/videos/upload', label: 'Upload', icon: Upload, variant: 'outline' as const },
    { href: '/live/create', label: 'Go Live', icon: Radio, variant: 'default' as const, highlight: true },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Logo />

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-red-600 ${
                  active ? 'text-red-600' : 'text-gray-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {actionButtons.map((button) => {
            const Icon = button.icon
            return (
              <Link key={button.href} href={button.href}>
                <Button
                  variant={button.variant}
                  size="sm"
                  className={button.highlight ? 'bg-red-600 hover:bg-red-700' : ''}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">{button.label}</span>
                </Button>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Mobile Navigation */}
      <nav className="md:hidden border-t px-4 py-2 flex justify-around">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
                active ? 'text-red-600' : 'text-gray-600'
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
