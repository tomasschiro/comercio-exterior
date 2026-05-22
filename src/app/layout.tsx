import type { Metadata } from 'next'
import { Inter_Tight } from 'next/font/google'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter-tight',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Comercio Exterior',
  description: 'Sistema de gestión de operaciones de comercio exterior',
  icons: { icon: '/logo-rms.png', apple: '/logo-rms.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${interTight.variable} ${GeistMono.variable}`}>
      <body className={interTight.className} style={{ minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  )
}
