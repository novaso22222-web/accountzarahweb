import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import '../public/style.css'

export const metadata: Metadata = {
  title: 'GameAccount.Vercel',
  description: 'Тоглоомын аккаунт худалдааны платформ',
  icons: {
    icon: '/account-hudaldaa-logo.png',
    apple: '/account-hudaldaa-logo.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0a0a0f',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="mn">
      <body className="antialiased">
        {children}
        
        {/* Хуучин script.js-ийг энд холбоно */}
        <Script src="/script.js" strategy="afterInteractive" />
        
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}