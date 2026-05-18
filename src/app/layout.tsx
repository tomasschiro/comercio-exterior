import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata: Metadata = {
  title: 'Comercio Exterior',
  description: 'Sistema de gestión de operaciones de comercio exterior',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={GeistMono.variable}>
      <body className={GeistSans.className} style={{ minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  )
}
