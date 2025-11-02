# Feature 6: Layout & Navigation

**Date**: 2025-11-01
**Estimated Time**: 2-3 hours
**Dependencies**: Feature 1 (Foundation & Setup)
**Priority**: P0 (Can be done in parallel with other features)

## Overview

Implement app-wide layout with navigation header, footer, and global styles. Provides consistent navigation across all pages.

## Components/Files to Create

```
apps/web/
├── app/
│   ├── layout.tsx              # Root layout (UPDATE)
│   └── globals.css             # Global styles (UPDATE)
└── components/
    ├── layout/
    │   ├── Header.tsx          # Navigation header
    │   └── Footer.tsx          # Footer
    └── ui/
        └── logo.tsx            # Logo component
```

## Tasks

### 1. Create Logo Component

**File**: `components/ui/logo.tsx`

```typescript
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
    lg: { icon: 'w-10 h-10', text: 'text-2xl' },
  }

  return (
    <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
      <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-1.5">
        <Video className={`${sizeClasses[size].icon} text-white`} />
      </div>
      {showText && (
        <span className={`font-bold ${sizeClasses[size].text} bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent`}>
          StreamVid
        </span>
      )}
    </Link>
  )
}
```

### 2. Create Header Component

**File**: `components/layout/Header.tsx`

```typescript
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
```

### 3. Create Footer Component

**File**: `components/layout/Footer.tsx`

```typescript
import Link from 'next/link'
import { Logo } from '@/components/ui/logo'
import { Github, Twitter } from 'lucide-react'

export function Footer() {
  const currentYear = new Date().getFullYear()

  const footerLinks = {
    product: [
      { label: 'Videos', href: '/' },
      { label: 'Live Streams', href: '/live' },
      { label: 'Upload', href: '/videos/upload' },
    ],
    company: [
      { label: 'About', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contact', href: '/contact' },
    ],
    legal: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Cookie Policy', href: '/cookies' },
    ],
  }

  const socialLinks = [
    { icon: Github, href: 'https://github.com', label: 'GitHub' },
    { icon: Twitter, href: 'https://twitter.com', label: 'Twitter' },
  ]

  return (
    <footer className="border-t bg-gray-50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <Logo size="md" />
            <p className="mt-4 text-sm text-gray-600">
              Stream and share your videos with the world. Live streaming and video hosting made simple.
            </p>
            <div className="flex gap-4 mt-4">
              {socialLinks.map((social) => {
                const Icon = social.icon
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 hover:text-red-600 transition"
                    aria-label={social.label}
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                )
              })}
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="font-semibold text-sm mb-4">Product</h3>
            <ul className="space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 hover:text-red-600 transition"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="font-semibold text-sm mb-4">Company</h3>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 hover:text-red-600 transition"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="font-semibold text-sm mb-4">Legal</h3>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-600 hover:text-red-600 transition"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t text-center text-sm text-gray-600">
          <p>© {currentYear} StreamVid. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
```

### 4. Update Root Layout

**File**: `app/layout.tsx`

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

const inter = Inter({ subsets: ['latin'] })

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
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
```

### 5. Update Global Styles

**File**: `app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;

    --card: 0 0% 100%;
    --card-foreground: 0 0% 3.9%;

    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 3.9%;

    --primary: 0 72.2% 50.6%;
    --primary-foreground: 0 0% 98%;

    --secondary: 0 0% 96.1%;
    --secondary-foreground: 0 0% 9%;

    --muted: 0 0% 96.1%;
    --muted-foreground: 0 0% 45.1%;

    --accent: 0 0% 96.1%;
    --accent-foreground: 0 0% 9%;

    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;

    --border: 0 0% 89.8%;
    --input: 0 0% 89.8%;
    --ring: 0 72.2% 50.6%;

    --radius: 0.5rem;
  }

  .dark {
    --background: 0 0% 3.9%;
    --foreground: 0 0% 98%;

    --card: 0 0% 3.9%;
    --card-foreground: 0 0% 98%;

    --popover: 0 0% 3.9%;
    --popover-foreground: 0 0% 98%;

    --primary: 0 72.2% 50.6%;
    --primary-foreground: 0 0% 9%;

    --secondary: 0 0% 14.9%;
    --secondary-foreground: 0 0% 98%;

    --muted: 0 0% 14.9%;
    --muted-foreground: 0 0% 63.9%;

    --accent: 0 0% 14.9%;
    --accent-foreground: 0 0% 98%;

    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;

    --border: 0 0% 14.9%;
    --input: 0 0% 14.9%;
    --ring: 0 72.2% 50.6%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

/* Custom utilities */
@layer utilities {
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

/* Focus styles for accessibility */
*:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

/* Video player custom styles */
video::-webkit-media-controls-panel {
  background-image: linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.5));
}
```

## Testing

### 1. Test Header Navigation

**Desktop**:

1. Visit all pages (`/`, `/live`, `/videos/upload`, `/live/create`)
2. Verify active state highlights correct nav item
3. Test logo click → redirects to home
4. Test all nav links work

**Mobile** (resize to < 768px):

1. Verify mobile nav appears at bottom
2. Test all mobile nav links
3. Verify action buttons stack properly

### 2. Test Footer

**Scroll to bottom on any page**:

1. Verify all footer sections display
2. Test footer links (may 404 for unimplemented pages)
3. Verify social links open in new tab
4. Check copyright year is current

### 3. Test Layout Consistency

Visit each page and verify:

- Header always at top (sticky)
- Footer always at bottom
- Content fills space between
- Responsive on all screen sizes

### 4. Test Navigation Flow

**User flow test**:

1. Start at home (`/`)
2. Click "Upload" → Upload page
3. Click logo → Back to home
4. Click "Live" → Live streams page
5. Click "Go Live" → Create stream page
6. Click "Videos" → Back to home

### 5. Accessibility Testing

**Keyboard navigation**:

1. Tab through header links
2. Verify focus indicators visible
3. Test Enter to activate links
4. Tab through footer links

**Screen reader** (if available):

- Verify landmarks (header, main, footer)
- Test alt text for logo
- Verify aria-labels on social icons

## Verification Checklist

- ✅ Logo component renders
- ✅ Header displays correctly
- ✅ Navigation highlights active page
- ✅ Action buttons work
- ✅ Mobile navigation works
- ✅ Footer displays correctly
- ✅ Footer links work
- ✅ Social links open in new tab
- ✅ Layout responsive on all sizes
- ✅ Sticky header works
- ✅ Min-height layout (footer at bottom)
- ✅ Global styles applied
- ✅ Focus states visible
- ✅ Smooth scrolling works

## Success Criteria

- ✅ Consistent navigation across all pages
- ✅ Header sticky at top
- ✅ Footer always at bottom
- ✅ Responsive design (mobile/tablet/desktop)
- ✅ Accessible keyboard navigation
- ✅ Clear visual hierarchy
- ✅ Brand identity consistent

## Responsive Breakpoints

- **Mobile**: < 768px (md breakpoint)
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

**Behavior**:

- Mobile: Bottom nav, stacked buttons
- Tablet: Top nav, buttons visible
- Desktop: Full nav, all elements visible

## Customization Options

To customize branding:

1. **Logo**: Update `components/ui/logo.tsx`
2. **Colors**: Update `app/globals.css` CSS variables
3. **Font**: Update `app/layout.tsx` font import
4. **Brand name**: Update "StreamVid" throughout
5. **Metadata**: Update `app/layout.tsx` metadata

## Next Steps

After completion:

- All features now connected via navigation
- Users can navigate entire app
- Consider adding user authentication (future)
- Consider adding dark mode toggle (future)

## Notes

- Using `sticky` position for header (better than `fixed` for accessibility)
- `min-h-screen` ensures footer at bottom even on short pages
- Active link detection uses `usePathname()` hook
- Mobile nav at bottom for thumb accessibility
- Social links placeholder - update with real URLs
- Footer links may 404 until pages created (expected)
- Consider adding breadcrumbs for deep navigation (future)
- Consider adding search functionality (future)
