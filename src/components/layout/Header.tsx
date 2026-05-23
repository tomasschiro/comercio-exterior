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
    { key: 'importacion' as Workspace, label: 'Importación',          total: counts.impoTotal, pend: counts.impoP, color: '#1E40AF', activeBg: '#EFF6FF', iconBg: '#EDF1FF', iconColor: '#1E40AF', shortcut: '1' },
    { key: 'exportacion' as Workspace, label: 'Exportación',          total: counts.expoTotal, pend: counts.expoP, color: '#9A3412', activeBg: '#FFF7F5', iconBg: '#FDE6CB', iconColor: '#9A3412', shortcut: '2' },
    { key: 'todas'       as Workspace, label: 'Todas las operaciones', total: counts.total,     pend: null,         color: '#1F1B14', activeBg: '#F5F1EB', iconBg: '#EEECE8', iconColor: '#6B6755', shortcut: '3' },
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
                {workspace === 'importacion' && (
                  <svg style={{ width: 13, height: 13, flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v13m0 0l-4-4m4 4l4-4M4 20h16" />
                  </svg>
                )}
                {workspace === 'exportacion' && (
                  <svg style={{ width: 13, height: 13, flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20V7m0 0l-4 4m4-4l4 4M4 4h16" />
                  </svg>
                )}
                {workspace === 'todas' && (
                  <svg style={{ width: 13, height: 13, flexShrink: 0 }} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>
                  </svg>
                )}
                {WS_LABEL[workspace]}
                <svg style={{ width: 10, height: 10, flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={dropdownOpen ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
                </svg>
              </button>

              {dropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  zIndex: 50,
                  background: '#FFFFFF',
                  border: '1px solid #E8DFC5',
                  borderRadius: 12,
                  boxShadow: '0 8px 28px rgba(31,27,20,.15)',
                  padding: '8px 0 6px',
                  minWidth: 272,
                }}>
                  <div style={{ padding: '2px 14px 8px', fontSize: 10, fontWeight: 600, letterSpacing: '0.09em', color: '#ADA482', textTransform: 'uppercase' }}>
                    Contexto de trabajo
                  </div>
                  {OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => applyWorkspace(opt.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        padding: '7px 12px',
                        gap: 10,
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        background: workspace === opt.key ? opt.activeBg : 'transparent',
                        color: '#1F1B14',
                        transition: 'background 80ms',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={e => { if (workspace !== opt.key) e.currentTarget.style.background = '#F5F1EB' }}
                      onMouseLeave={e => { if (workspace !== opt.key) e.currentTarget.style.background = 'transparent' }}
                    >
                      <div style={{ width: 32, height: 32, background: opt.iconBg, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {opt.key === 'importacion' && (
                          <svg width="15" height="15" fill="none" stroke={opt.iconColor} strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v13m0 0l-4-4m4 4l4-4M4 20h16" />
                          </svg>
                        )}
                        {opt.key === 'exportacion' && (
                          <svg width="15" height="15" fill="none" stroke={opt.iconColor} strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 20V7m0 0l-4 4m4-4l4 4M4 4h16" />
                          </svg>
                        )}
                        {opt.key === 'todas' && (
                          <svg width="15" height="15" fill={opt.iconColor} viewBox="0 0 24 24">
                            <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1F1B14', lineHeight: 1.3 }}>{opt.label}</div>
                        <div style={{ fontSize: 11, color: '#7A7158', lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>
                          {opt.total} op{opt.total !== 1 ? 's.' : '.'}
                          {opt.pend !== null && <span style={{ color: '#ADA482' }}> · {opt.pend} pend.</span>}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, color: '#ADA482', flexShrink: 0 }}>Ctrl {opt.shortcut}</span>
                    </button>
                  ))}
                  <div style={{ height: 1, background: '#E8DFC5', margin: '6px 0 4px' }} />
                  <div style={{ padding: '0 14px 4px', fontSize: 11, color: '#B8AD95', fontStyle: 'italic' }}>
                    Tu última selección se recuerda al reabrir la app.
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
