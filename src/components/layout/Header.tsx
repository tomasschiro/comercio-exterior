'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface HeaderProps {
  email?: string
  rol?: string
}

export default function Header({ email, rol }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const initials = email
    ? email.split('@')[0].slice(0, 2).toUpperCase()
    : '?'

  return (
    <header
      style={{
        height: 48,
        background: 'rgba(250,247,238,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid #E8DFC5',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      <div
        style={{
          maxWidth: 1536,
          margin: '0 auto',
          padding: '0 24px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Left: logo + nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, background: '#1F1B14', borderRadius: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1F1B14', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
              R.M.S Comercio Exterior
            </span>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {[
              { href: '/dashboard', label: 'Inicio' },
              { href: '/operaciones', label: 'Operaciones' },
              { href: '/reportes', label: 'Reportes' },
              ...(rol === 'superadmin' ? [{ href: '/maestros', label: 'Maestros' }] : []),
              ...(rol === 'superadmin' ? [{ href: '/admin', label: 'Admin' }] : []),
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                style={{
                  fontSize: 13,
                  padding: '4px 10px',
                  borderRadius: 6,
                  textDecoration: 'none',
                  transition: 'background 100ms, color 100ms',
                  color: isActive(href) ? '#1F1B14' : '#7A7158',
                  background: isActive(href) ? '#F2ECDC' : 'transparent',
                  fontWeight: isActive(href) ? 500 : 400,
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right: user pill + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {email && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#F2ECDC',
                borderRadius: 20,
                padding: '3px 10px 3px 3px',
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  background: '#1F1B14',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#FFFFFF',
                  letterSpacing: '0.02em',
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <span
                style={{
                  fontSize: 12,
                  color: '#7A7158',
                  maxWidth: 160,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {email}
              </span>
            </div>
          )}

          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              color: '#ADA482',
              padding: '4px 0',
              transition: 'color 100ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#1F1B14')}
            onMouseLeave={e => (e.currentTarget.style.color = '#ADA482')}
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  )
}
