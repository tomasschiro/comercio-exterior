'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

interface PerfilPendiente {
  id: string
  email: string
  nombre: string | null
  created_at: string
}

async function getToken(): Promise<string | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

// ── table styles ──────────────────────────────────────────

const TH: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 16px',
  fontSize: 10, fontWeight: 500,
  textTransform: 'uppercase', letterSpacing: '0.06em',
  color: 'var(--ink-3)',
  background: 'var(--surface)',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap',
}

const TD: React.CSSProperties = {
  padding: '10px 16px',
  borderTop: '1px solid var(--line)',
  fontSize: 13,
}

// ── component ─────────────────────────────────────────────

export default function AdminPanel() {
  const [pendientes, setPendientes] = useState<PerfilPendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  const fetchPendientes = useCallback(async () => {
    setLoading(true)
    setError('')
    const token = await getToken()
    const res = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (res.ok) setPendientes(data)
    else setError(data.error ?? 'Error al cargar usuarios')
    setLoading(false)
  }, [])

  useEffect(() => { fetchPendientes() }, [fetchPendientes])

  async function handleAction(userId: string, action: 'approve' | 'reject') {
    setActionLoading(userId + action)
    const token = await getToken()
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, userId }),
    })
    if (res.ok) {
      setPendientes(prev => prev.filter(p => p.id !== userId))
    } else {
      const data = await res.json()
      setError(data.error ?? 'Error al procesar la acción')
    }
    setActionLoading(null)
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink-1)', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
          Panel de administración
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>Usuarios pendientes de aprobación</p>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: '10px 16px', background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--bad)' }}>
          {error}
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '64px 20px', color: 'var(--ink-4)', fontSize: 13 }}>
            <svg style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
              <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            Cargando...
          </div>
        ) : pendientes.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '64px 20px', color: 'var(--ink-4)' }}>
            <svg style={{ width: 40, height: 40, color: 'var(--surface-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p style={{ fontSize: 13, margin: 0 }}>No hay usuarios pendientes de aprobación</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Nombre</th>
                <th style={TH}>Email</th>
                <th style={TH}>Fecha de registro</th>
                <th style={{ ...TH, width: 192 }} />
              </tr>
            </thead>
            <tbody>
              {pendientes.map(p => (
                <tr
                  key={p.id}
                  style={{ transition: 'background 80ms' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--row-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...TD, fontWeight: 600, color: 'var(--ink-1)' }}>{p.nombre || '—'}</td>
                  <td style={{ ...TD, color: 'var(--ink-2)' }}>{p.email}</td>
                  <td style={{ ...TD, color: 'var(--ink-3)' }}>{formatDate(p.created_at)}</td>
                  <td style={TD}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        onClick={() => handleAction(p.id, 'approve')}
                        disabled={actionLoading !== null}
                        style={{
                          padding: '4px 12px', fontSize: 12, fontWeight: 500,
                          color: '#FFFFFF', background: actionLoading !== null ? 'var(--ok-bg)' : 'var(--ok)',
                          border: 'none', borderRadius: 'var(--radius)',
                          cursor: actionLoading !== null ? 'not-allowed' : 'pointer',
                          fontFamily: 'inherit', transition: 'background 100ms',
                        }}
                        onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#14532D' }}
                        onMouseLeave={e => { if (!actionLoading) e.currentTarget.style.background = 'var(--ok)' }}
                      >
                        {actionLoading === p.id + 'approve' ? 'Aprobando...' : 'Aprobar'}
                      </button>
                      <button
                        onClick={() => handleAction(p.id, 'reject')}
                        disabled={actionLoading !== null}
                        style={{
                          padding: '4px 12px', fontSize: 12, fontWeight: 500,
                          color: '#FFFFFF', background: actionLoading !== null ? 'var(--bad-bg)' : 'var(--bad)',
                          border: 'none', borderRadius: 'var(--radius)',
                          cursor: actionLoading !== null ? 'not-allowed' : 'pointer',
                          fontFamily: 'inherit', transition: 'background 100ms',
                        }}
                        onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.background = '#7F1D1D' }}
                        onMouseLeave={e => { if (!actionLoading) e.currentTarget.style.background = 'var(--bad)' }}
                      >
                        {actionLoading === p.id + 'reject' ? 'Rechazando...' : 'Rechazar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
