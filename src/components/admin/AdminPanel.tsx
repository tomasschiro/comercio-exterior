'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { Perfil } from '@/types/database'

async function getToken(): Promise<string | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

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

export default function AdminPanel() {
  const [pendientes, setPendientes] = useState<Perfil[]>([])
  const [activos, setActivos] = useState<Perfil[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [migrationSql, setMigrationSql] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    const token = await getToken()
    const [usersRes, migrateRes] = await Promise.all([
      fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/admin/migrate', { headers: { Authorization: `Bearer ${token}` } }),
    ])
    const usersData = await usersRes.json()
    if (usersRes.ok) {
      setPendientes(usersData.pendientes ?? [])
      setActivos(usersData.activos ?? [])
    } else {
      setError(usersData.error ?? 'Error al cargar usuarios')
    }
    const migrateData = await migrateRes.json()
    if (migrateRes.ok && !migrateData.ok) {
      setMigrationSql(migrateData.sql)
    } else {
      setMigrationSql(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function handleAction(userId: string, action: string, rol?: string) {
    setActionLoading(userId + action)
    const token = await getToken()
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, userId, rol }),
    })
    if (res.ok) {
      await fetchUsers()
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

  function copySQL() {
    if (migrationSql) {
      navigator.clipboard.writeText(migrationSql).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  const Spinner = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '48px 20px', color: 'var(--ink-4)', fontSize: 13 }}>
      <svg style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
        <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      Cargando...
    </div>
  )

  const BtnSmall = ({ label, loadingLabel, onClick, variant, disabled }: {
    label: string; loadingLabel?: string; onClick: () => void; variant: 'ok' | 'bad' | 'ghost'; disabled?: boolean
  }) => {
    const bg = variant === 'ok' ? 'var(--ok)' : variant === 'bad' ? 'var(--bad)' : 'var(--surface)'
    const color = variant === 'ghost' ? 'var(--ink-2)' : '#FFFFFF'
    const border = variant === 'ghost' ? '1px solid var(--line)' : 'none'
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          padding: '4px 10px', fontSize: 12, fontWeight: 500,
          color: disabled ? 'var(--ink-4)' : color,
          background: disabled ? 'var(--surface-2)' : bg,
          border, borderRadius: 'var(--radius)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', transition: 'opacity 100ms',
          whiteSpace: 'nowrap',
        }}
      >
        {disabled && loadingLabel ? loadingLabel : label}
      </button>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink-1)', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
          Panel de administración
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>Gestión de usuarios y configuración</p>
      </div>

      {migrationSql && (
        <div style={{ marginBottom: 20, padding: '14px 16px', background: '#FFFBEB', border: '1px solid #F59E0B', borderRadius: 'var(--radius-lg)', fontSize: 13 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#92400E' }}>Migración de base de datos requerida</p>
          <p style={{ margin: '0 0 10px', color: '#78350F', lineHeight: 1.5 }}>
            El campo <code style={{ background: '#FEF3C7', padding: '1px 4px', borderRadius: 3 }}>mail_enviado</code> no existe en la tabla <code style={{ background: '#FEF3C7', padding: '1px 4px', borderRadius: 3 }}>operaciones</code>. Ejecutar este SQL en el Supabase Dashboard:
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ flex: 1, background: '#FEF3C7', padding: '8px 12px', borderRadius: 4, fontSize: 12, color: '#1F1B14', wordBreak: 'break-all' }}>{migrationSql}</code>
            <button onClick={copySQL} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, border: '1px solid #F59E0B', borderRadius: 4, background: copied ? '#D97706' : '#FFFFFF', color: copied ? '#FFFFFF' : '#92400E', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', transition: 'background 150ms' }}>
              {copied ? 'Copiado' : 'Copiar SQL'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 16, padding: '10px 16px', background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--bad)' }}>
          {error}
        </div>
      )}

      {/* Pendientes */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-1)', margin: '0 0 12px', letterSpacing: '-0.01em' }}>
          Pendientes de aprobación
          {!loading && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--ink-4)' }}>({pendientes.length})</span>}
        </h2>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          {loading ? <Spinner /> : pendientes.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px 20px', color: 'var(--ink-4)', fontSize: 13 }}>
              <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Sin usuarios pendientes
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Nombre</th>
                  <th style={TH}>Email</th>
                  <th style={TH}>Fecha</th>
                  <th style={{ ...TH, width: 180 }} />
                </tr>
              </thead>
              <tbody>
                {pendientes.map(p => (
                  <tr key={p.id}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--row-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ ...TD, fontWeight: 600, color: 'var(--ink-1)' }}>{p.nombre || '—'}</td>
                    <td style={{ ...TD, color: 'var(--ink-2)' }}>{p.email}</td>
                    <td style={{ ...TD, color: 'var(--ink-3)' }}>{formatDate(p.created_at)}</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        <BtnSmall label="Aprobar" loadingLabel="Aprobando..." onClick={() => handleAction(p.id, 'approve')} variant="ok" disabled={actionLoading !== null} />
                        <BtnSmall label="Rechazar" loadingLabel="Rechazando..." onClick={() => handleAction(p.id, 'reject')} variant="bad" disabled={actionLoading !== null} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Activos */}
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-1)', margin: '0 0 12px', letterSpacing: '-0.01em' }}>
          Usuarios activos
          {!loading && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--ink-4)' }}>({activos.length})</span>}
        </h2>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          {loading ? <Spinner /> : activos.length === 0 ? (
            <div style={{ padding: '24px 20px', color: 'var(--ink-4)', fontSize: 13 }}>Sin usuarios activos</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Nombre</th>
                  <th style={TH}>Email</th>
                  <th style={TH}>Rol</th>
                  <th style={{ ...TH, width: 260 }} />
                </tr>
              </thead>
              <tbody>
                {activos.map(u => (
                  <tr key={u.id}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--row-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ ...TD, fontWeight: 600, color: 'var(--ink-1)' }}>{u.nombre || '—'}</td>
                    <td style={{ ...TD, color: 'var(--ink-2)' }}>{u.email}</td>
                    <td style={TD}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                        background: u.rol === 'superadmin' ? '#EFF6FF' : 'var(--surface-2)',
                        color: u.rol === 'superadmin' ? '#1D4ED8' : 'var(--ink-3)',
                        border: u.rol === 'superadmin' ? '1px solid #BFDBFE' : '1px solid var(--line)',
                        letterSpacing: '0.02em',
                      }}>
                        {u.rol === 'superadmin' ? 'Superadmin' : 'Operador'}
                      </span>
                    </td>
                    <td style={TD}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        {u.rol === 'operador' ? (
                          <BtnSmall label="→ Superadmin" onClick={() => handleAction(u.id, 'changeRole', 'superadmin')} variant="ghost" disabled={actionLoading !== null} />
                        ) : (
                          <BtnSmall label="→ Operador" onClick={() => handleAction(u.id, 'changeRole', 'operador')} variant="ghost" disabled={actionLoading !== null} />
                        )}
                        <BtnSmall label="Desactivar" onClick={() => handleAction(u.id, 'deactivate')} variant="ghost" disabled={actionLoading !== null} />
                        <BtnSmall label="Eliminar" onClick={() => handleAction(u.id, 'delete')} variant="bad" disabled={actionLoading !== null} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
