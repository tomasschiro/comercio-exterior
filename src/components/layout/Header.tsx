'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useEffect, useState, useRef } from 'react'

type Workspace = 'importacion' | 'exportacion' | 'todas'

interface OpCounts {
  impoTotal: number
  impoP: number
  expoTotal: number
  expoP: number
  total: number
  atrasadas: number
  retenidas: number
}

const WS_COLOR: Record<Workspace, string> = {
  importacion: '#1E40AF',
  exportacion: '#9A3412',
  todas: '#1F1B14',
}

const WS_LABEL: Record<Workspace, string> = {
  importacion: 'Importación',
  exportacion: 'Exportación',
  todas: 'Todas',
}

interface HeaderProps {
  email?: string
  rol?: string
}

export default function Header({ email, rol }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [workspace, setWorkspace] = useState<Workspace>('todas')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [counts, setCounts] = useState<OpCounts>({ impoTotal: 0, impoP: 0, expoTotal: 0, expoP: 0, total: 0, atrasadas: 0, retenidas: 0 })
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isOnOperaciones = pathname === '/operaciones' || pathname.startsWith('/operaciones/')

  useEffect(() => {
    const saved = localStorage.getItem('rms.workspace') as Workspace | null
    if (saved && (saved === 'importacion' || saved === 'exportacion' || saved === 'todas')) {
      setWorkspace(saved)
    }
  }, [])

  useEffect(() => {
    function handler(e: Event) {
      setCounts((e as CustomEvent<OpCounts>).detail)
    }
    window.addEventListener('operaciones-counts', handler)
    return () => window.removeEventListener('operaciones-counts', handler)
  }, [])

  useEffect(() => {
    if (!dropdownOpen) return
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!e.ctrlKey) return
      const ws = e.key === '1' ? 'importacion' : e.key === '2' ? 'exportacion' : e.key === '3' ? 'todas' : null
      if (!ws) return
      e.preventDefault()
      applyWorkspace(ws as Workspace)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  function applyWorkspace(ws: Workspace) {
    setWorkspace(ws)
    localStorage.setItem('rms.workspace', ws)
    window.dispatchEvent(new CustomEvent('workspace-change', { detail: { workspace: ws } }))
    setDropdownOpen(false)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const initials = email ? email.split('@')[0].slice(0, 2).toUpperCase() : '?'
  const wsColor = WS_COLOR[workspace]
  const borderColor = isOnOperaciones ? wsColor : '#E8DFC5'
  const borderWidth = isOnOperaciones ? 2 : 1

  const OPTIONS = [
    { key: 'importacion' as Workspace, label: 'Importación',        total: counts.impoTotal, pend: counts.impoP,  color: '#1E40AF', activeBg: '#EFF6FF' },
    { key: 'exportacion' as Workspace, label: 'Exportación',        total: counts.expoTotal, pend: counts.expoP,  color: '#9A3412', activeBg: '#FFF7F5' },
    { key: 'todas'       as Workspace, label: 'Todas las operaciones', total: counts.total,  pend: null,           color: '#1F1B14', activeBg: '#F5F1EB' },
  ]

  return (
    <header
      style={{
        height: 48,
        background: 'rgba(250,247,238,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: `${borderWidth}px solid ${borderColor}`,
        position: 'sticky',
        top: 0,
        zIndex: 40,
        transition: 'border-color 200ms',
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
        {/* Left: logo + workspace picker + nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img src="/logo-rms.png" alt="RMS Comercio Exterior" style={{ height: 32, width: 'auto', display: 'block' }} />

          {/* Workspace Picker — only on /operaciones */}
          {isOnOperaciones && (
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setDropdownOpen(v => !v)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0 9px 0 8px',
                  height: 28,
                  background: '#FFFFFF',
                  border: `1.5px solid ${wsColor}`,
                  borderRadius: 20,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  color: wsColor,
                  whiteSpace: 'nowrap',
                  transition: 'background 80ms',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F5F1EB' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF' }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: wsColor, flexShrink: 0 }} />
                {WS_LABEL[workspace]}
                <svg style={{ width: 10, height: 10, flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={dropdownOpen ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
                </svg>
              </button>

              {dropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  zIndex: 50,
                  background: '#FFFFFF',
                  border: '1px solid #E8DFC5',
                  borderRadius: 10,
                  boxShadow: '0 4px 20px rgba(31,27,20,.12)',
                  padding: 6,
                  minWidth: 230,
                }}>
                  {OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => applyWorkspace(opt.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        padding: '8px 10px',
                        gap: 8,
                        fontSize: 13,
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        background: workspace === opt.key ? opt.activeBg : 'transparent',
                        color: '#1F1B14',
                        fontWeight: workspace === opt.key ? 600 : 400,
                        transition: 'background 80ms',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={e => { if (workspace !== opt.key) e.currentTarget.style.background = '#F5F1EB' }}
                      onMouseLeave={e => { if (workspace !== opt.key) e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{opt.label}</span>
                      <span style={{ fontSize: 11, color: '#7A7158', display: 'flex', gap: 4, alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>
                        {opt.total}
                        {opt.pend !== null && <span style={{ color: '#ADA482' }}>· {opt.pend} pend.</span>}
                      </span>
                    </button>
                  ))}

                  <div style={{ height: 1, background: '#E8DFC5', margin: '4px 0' }} />
                  <div style={{ padding: '4px 10px 2px', display: 'flex', gap: 10 }}>
                    {[
                      { label: 'Ctrl 1 Impo' },
                      { label: 'Ctrl 2 Expo' },
                      { label: 'Ctrl 3 Todas' },
                    ].map(k => (
                      <span key={k.label} style={{ fontSize: 10, color: '#ADA482' }}>{k.label}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {[
              { href: '/dashboard',  label: 'Inicio' },
              { href: '/operaciones', label: 'Operaciones' },
              { href: '/reportes',   label: 'Reportes' },
              ...(rol === 'superadmin' ? [{ href: '/maestros', label: 'Maestros' }] : []),
              ...(rol === 'superadmin' ? [{ href: '/admin',    label: 'Admin'    }] : []),
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

        {/* Right: global alerts + user pill + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {(counts.atrasadas > 0 || counts.retenidas > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500, color: '#991B1B' }}>
              {counts.atrasadas > 0 && (
                <span>{counts.atrasadas} atrasada{counts.atrasadas !== 1 ? 's' : ''}</span>
              )}
              {counts.atrasadas > 0 && counts.retenidas > 0 && (
                <span style={{ color: '#ADA482' }}>·</span>
              )}
              {counts.retenidas > 0 && (
                <span>{counts.retenidas} retenida{counts.retenidas !== 1 ? 's' : ''} en SENASA</span>
              )}
            </div>
          )}

          {email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F2ECDC', borderRadius: 20, padding: '3px 10px 3px 3px' }}>
              <div style={{ width: 22, height: 22, background: '#1F1B14', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#FFFFFF', letterSpacing: '0.02em', flexShrink: 0 }}>
                {initials}
              </div>
              <span style={{ fontSize: 12, color: '#7A7158', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {email}
              </span>
            </div>
          )}

          <button
            onClick={handleLogout}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#ADA482', padding: '4px 0', transition: 'color 100ms' }}
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
