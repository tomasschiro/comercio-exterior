'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Cliente, Transporte } from '@/types/database'

interface Props {
  clientes: Cliente[]
  transportes: Transporte[]
  userRol: string
}

// ── shared styles ─────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  fontSize: 13,
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius)',
  outline: 'none',
  color: 'var(--ink-1)',
  background: 'var(--surface)',
  fontFamily: 'inherit',
}

const BTN_PRIMARY: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '0 12px', height: 28,
  fontSize: 12, fontWeight: 500,
  color: '#FFFFFF', background: 'var(--ink-1)',
  border: '1px solid var(--ink-1)',
  borderRadius: 'var(--radius)', cursor: 'pointer',
  fontFamily: 'inherit',
}

const BTN_SECONDARY: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '0 10px', height: 26,
  fontSize: 12, fontWeight: 500,
  color: 'var(--ink-2)', background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius)', cursor: 'pointer',
  fontFamily: 'inherit',
}

const BTN_OK: React.CSSProperties = {
  padding: '2px 8px', height: 24,
  fontSize: 11, fontWeight: 500,
  color: '#FFFFFF', background: 'var(--ok)',
  border: '1px solid var(--ok)',
  borderRadius: 'var(--radius)', cursor: 'pointer',
  fontFamily: 'inherit',
}

// ── utilities ─────────────────────────────────────────────

async function getToken(): Promise<string | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

async function apiFetch(path: string, method: string, body?: object) {
  const token = await getToken()
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error desconocido')
  return data
}

function isValidEmailAddr(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

// ── icon helpers ──────────────────────────────────────────

function IconPlus() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v16m8-8H4" />
    </svg>
  )
}

function IconEdit() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

// ── Modals ────────────────────────────────────────────────

function ModalCliente({ initial, onSave, onClose, zIndex = 50 }: {
  initial?: Cliente
  onSave: (c: Cliente) => void
  onClose: () => void
  zIndex?: number
}) {
  const [form, setForm] = useState({
    nombre: initial?.nombre ?? '',
    email: initial?.email ?? '',
    telefono: initial?.telefono ?? '',
  })
  const [emailsAd, setEmailsAd] = useState<string[]>(initial?.emails_adicionales ?? [])
  const [emailAdInput, setEmailAdInput] = useState('')
  const [emailAdError, setEmailAdError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function addEmailAd() {
    const trimmed = emailAdInput.trim()
    if (!isValidEmailAddr(trimmed)) { setEmailAdError('Email inválido'); return }
    if (emailsAd.includes(trimmed)) { setEmailAdError('Ya fue agregado'); return }
    setEmailsAd(prev => [...prev, trimmed])
    setEmailAdInput('')
    setEmailAdError('')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) return
    setLoading(true)
    setError('')
    try {
      const pendingEmail = emailAdInput.trim()
      const finalEmailsAd = (
        pendingEmail && isValidEmailAddr(pendingEmail) && !emailsAd.includes(pendingEmail)
          ? [...emailsAd, pendingEmail]
          : emailsAd
      ).slice(0, 2)
      const payload = {
        nombre: form.nombre.trim(),
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        emails_adicionales: finalEmailsAd.length > 0 ? finalEmailsAd : null,
      }
      console.log('[ModalCliente] handleSave payload:', JSON.stringify(payload))
      if (initial) {
        await apiFetch('/api/maestros/clientes', 'PUT', { id: initial.id, ...payload })
        onSave({ ...initial, ...payload })
      } else {
        const data = await apiFetch('/api/maestros/clientes', 'POST', payload)
        onSave(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(15,17,21,.22)', backdropFilter: 'blur(2px)', padding: 16,
    }}>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', width: '100%', maxWidth: 400, boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--line)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>{initial ? 'Editar cliente' : 'Nuevo cliente'}</span>
          <button onClick={onClose} style={{ ...BTN_SECONDARY, padding: '0', width: 26, height: 26, border: 'none', background: 'transparent', color: 'var(--ink-3)' }}>
            <IconX />
          </button>
        </div>
        <form onSubmit={handleSave} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FieldRow label="Nombre *">
            <input type="text" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              style={INPUT} placeholder="Nombre del cliente" autoFocus required />
          </FieldRow>
          <FieldRow label="Email principal">
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              style={INPUT} placeholder="email@ejemplo.com" />
          </FieldRow>
          <FieldRow label="Teléfono">
            <input type="text" value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
              style={INPUT} placeholder="+54 9 ..." />
          </FieldRow>

          <FieldRow label="Emails adicionales">
            <div>
              {emailsAd.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {emailsAd.map(email => (
                    <div key={email} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 20, padding: '3px 6px 3px 10px', fontSize: 12, color: '#1E40AF' }}>
                      <span style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
                      <button type="button" onClick={() => setEmailsAd(prev => prev.filter(e => e !== email))}
                        style={{ width: 16, height: 16, borderRadius: '50%', border: 'none', background: 'rgba(30,64,175,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0, color: '#1E40AF', fontSize: 14, lineHeight: 1, fontFamily: 'inherit' }}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {emailsAd.length < 2 && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="email" value={emailAdInput}
                    onChange={e => { setEmailAdInput(e.target.value); setEmailAdError('') }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmailAd() } }}
                    placeholder="email@ejemplo.com"
                    style={{ ...INPUT, border: `1px solid ${emailAdError ? '#EF4444' : 'var(--line)'}` }} />
                  <button type="button" onClick={addEmailAd} disabled={!emailAdInput.trim()}
                    style={{ width: 34, height: 29, borderRadius: 'var(--radius)', border: '1px solid var(--line)', background: 'var(--surface)', cursor: !emailAdInput.trim() ? 'default' : 'pointer', color: !emailAdInput.trim() ? 'var(--ink-4)' : 'var(--ink-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20, lineHeight: 1, fontFamily: 'inherit' }}>
                    +
                  </button>
                </div>
              )}
              {emailAdError && <div style={{ marginTop: 5, fontSize: 11, color: '#EF4444' }}>{emailAdError}</div>}
              {emailsAd.length === 2 && (
                <div style={{ marginTop: 5, fontSize: 11, color: 'var(--ink-4)' }}>Máximo 2 emails adicionales</div>
              )}
            </div>
          </FieldRow>

          {error && <p style={{ fontSize: 12, color: 'var(--bad)', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={BTN_SECONDARY}>Cancelar</button>
            <button type="submit" disabled={loading || !form.nombre.trim()} style={{ ...BTN_PRIMARY, opacity: loading || !form.nombre.trim() ? 0.5 : 1 }}>
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalNuevoTransporte({ onSave, onClose, zIndex = 50 }: {
  onSave: (t: Transporte) => void
  onClose: () => void
  zIndex?: number
}) {
  const [form, setForm] = useState({ nombre: '', telefono: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) return
    setLoading(true)
    setError('')
    try {
      const data = await apiFetch('/api/maestros/transportes', 'POST', {
        nombre: form.nombre.trim(),
        telefono: form.telefono.trim() || null,
      })
      onSave(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(15,17,21,.22)', backdropFilter: 'blur(2px)', padding: 16,
    }}>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', width: '100%', maxWidth: 360, boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--line)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>Nuevo transporte</span>
          <button onClick={onClose} style={{ ...BTN_SECONDARY, padding: '0', width: 26, height: 26, border: 'none', background: 'transparent', color: 'var(--ink-3)' }}>
            <IconX />
          </button>
        </div>
        <form onSubmit={handleSave} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FieldRow label="Nombre *">
            <input type="text" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              style={INPUT} placeholder="Nombre del transporte" autoFocus required />
          </FieldRow>
          <FieldRow label="Teléfono">
            <input type="text" value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
              style={INPUT} placeholder="+54 9 ..." />
          </FieldRow>
          {error && <p style={{ fontSize: 12, color: 'var(--bad)', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={BTN_SECONDARY}>Cancelar</button>
            <button type="submit" disabled={loading || !form.nombre.trim()} style={{ ...BTN_PRIMARY, opacity: loading || !form.nombre.trim() ? 0.5 : 1 }}>
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      {children}
    </div>
  )
}

// ── TablaClientes ─────────────────────────────────────────

function TablaClientes({ clientes: init, isSuperadmin }: { clientes: Cliente[]; isSuperadmin: boolean }) {
  const [clientes, setClientes] = useState(init)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [showNuevo, setShowNuevo] = useState(false)
  const [loadingId, setLoadingId] = useState<number | null>(null)

  async function toggleActivo(c: Cliente, e: React.MouseEvent) {
    e.stopPropagation()
    setLoadingId(c.id)
    try {
      await apiFetch('/api/maestros/clientes', 'PUT', { id: c.id, activo: !c.activo })
      setClientes(prev => prev.map(x => x.id === c.id ? { ...x, activo: !x.activo } : x))
    } catch { /**/ }
    setLoadingId(null)
  }

  async function deleteCliente(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm('¿Eliminar este cliente? Esta acción no se puede deshacer.')) return
    setLoadingId(id)
    try {
      await apiFetch('/api/maestros/clientes', 'DELETE', { id })
      setClientes(prev => prev.filter(c => c.id !== id))
      if (editingCliente?.id === id) setEditingCliente(null)
    } catch { /**/ }
    setLoadingId(null)
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>Clientes</div>
          <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 1 }}>{clientes.length} registros</div>
        </div>
        {isSuperadmin && (
          <button onClick={() => setShowNuevo(true)} style={BTN_PRIMARY}>
            <IconPlus /> Nuevo cliente
          </button>
        )}
      </div>

      {clientes.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '0 0 8px' }}>No hay clientes cargados</p>
          {isSuperadmin && (
            <button onClick={() => setShowNuevo(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--accent)', fontFamily: 'inherit' }}>
              + Agregar el primero
            </button>
          )}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface)' }}>
                {['Nombre', 'Email', 'Teléfono', 'Activo', ...(isSuperadmin ? ['Acciones'] : [])].map(h => (
                  <th key={h} style={{
                    padding: '8px 16px', textAlign: 'left',
                    fontSize: 10, fontWeight: 500,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: 'var(--ink-3)',
                    borderBottom: '1px solid var(--line)',
                    whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientes.map(c => {
                const isLoading = loadingId === c.id
                return (
                  <tr
                    key={c.id}
                    onClick={() => isSuperadmin && setEditingCliente(c)}
                    style={{
                      borderTop: '1px solid var(--line)',
                      cursor: isSuperadmin ? 'pointer' : 'default',
                      background: 'var(--surface)',
                      transition: 'background 80ms',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--row-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)' }}
                  >
                    <td style={{ padding: '8px 16px', minWidth: 160 }}>
                      <span style={{ fontWeight: 500, color: 'var(--ink-1)' }}>{c.nombre}</span>
                    </td>
                    <td style={{ padding: '8px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ color: 'var(--ink-2)' }}>{c.email ?? '—'}</span>
                        {c.emails_adicionales && c.emails_adicionales.length > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                            +{c.emails_adicionales.length} adicional{c.emails_adicionales.length !== 1 ? 'es' : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '8px 16px' }}>
                      <span style={{ color: 'var(--ink-2)' }}>{c.telefono ?? '—'}</span>
                    </td>
                    <td style={{ padding: '8px 16px' }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={e => toggleActivo(c, e)}
                        disabled={isLoading}
                        style={{
                          padding: '2px 10px', borderRadius: 100, fontSize: 11, fontWeight: 500,
                          border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                          opacity: isLoading ? 0.5 : 1,
                          background: c.activo ? 'var(--ok-bg)' : 'var(--neutral-bg)',
                          color: c.activo ? 'var(--ok)' : 'var(--ink-3)',
                          transition: 'background 100ms',
                        }}
                      >
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    {isSuperadmin && (
                      <td style={{ padding: '8px 16px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <IconBtn onClick={e => { e.stopPropagation(); setEditingCliente(c) }} title="Editar">
                            <IconEdit />
                          </IconBtn>
                          <IconBtn onClick={e => deleteCliente(c.id, e)} title="Eliminar" danger disabled={isLoading}>
                            <IconTrash />
                          </IconBtn>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {(showNuevo || editingCliente) && (
        <ModalCliente
          initial={editingCliente ?? undefined}
          onSave={c => {
            if (editingCliente) {
              setClientes(prev => prev.map(x => x.id === c.id ? c : x))
            } else {
              setClientes(prev => [...prev, c].sort((a, b) => a.nombre.localeCompare(b.nombre)))
            }
            setShowNuevo(false)
            setEditingCliente(null)
          }}
          onClose={() => { setShowNuevo(false); setEditingCliente(null) }}
        />
      )}
    </div>
  )
}

// ── TablaTransportes ──────────────────────────────────────

function TablaTransportes({ transportes: init, isSuperadmin }: { transportes: Transporte[]; isSuperadmin: boolean }) {
  const [transportes, setTransportes] = useState(init)
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ nombre: '', telefono: '' })
  const [showNuevo, setShowNuevo] = useState(false)
  const [loadingId, setLoadingId] = useState<number | null>(null)

  function startEdit(t: Transporte) {
    setEditId(t.id)
    setEditForm({ nombre: t.nombre, telefono: t.telefono ?? '' })
  }

  async function saveEdit() {
    if (!editId) return
    setLoadingId(editId)
    const updates = {
      nombre: editForm.nombre.trim(),
      telefono: editForm.telefono.trim() || null,
    }
    try {
      await apiFetch('/api/maestros/transportes', 'PUT', { id: editId, ...updates })
      setTransportes(prev => prev.map(t => t.id === editId ? { ...t, ...updates } : t))
      setEditId(null)
    } catch {
      // keep edit open
    }
    setLoadingId(null)
  }

  async function toggleActivo(t: Transporte, e: React.MouseEvent) {
    e.stopPropagation()
    setLoadingId(t.id)
    try {
      await apiFetch('/api/maestros/transportes', 'PUT', { id: t.id, activo: !t.activo })
      setTransportes(prev => prev.map(x => x.id === t.id ? { ...x, activo: !x.activo } : x))
    } catch { /**/ }
    setLoadingId(null)
  }

  async function deleteTransporte(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm('¿Eliminar este transporte? Esta acción no se puede deshacer.')) return
    setLoadingId(id)
    try {
      await apiFetch('/api/maestros/transportes', 'DELETE', { id })
      setTransportes(prev => prev.filter(t => t.id !== id))
      if (editId === id) setEditId(null)
    } catch { /**/ }
    setLoadingId(null)
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>Transportes</div>
          <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 1 }}>{transportes.length} registros</div>
        </div>
        {isSuperadmin && (
          <button onClick={() => setShowNuevo(true)} style={BTN_PRIMARY}>
            <IconPlus /> Nuevo transporte
          </button>
        )}
      </div>

      {transportes.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '0 0 8px' }}>No hay transportes cargados</p>
          {isSuperadmin && (
            <button onClick={() => setShowNuevo(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--accent)', fontFamily: 'inherit' }}>
              + Agregar el primero
            </button>
          )}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface)' }}>
                {['Nombre', 'Teléfono', 'Activo', ...(isSuperadmin ? ['Acciones'] : [])].map(h => (
                  <th key={h} style={{
                    padding: '8px 16px', textAlign: 'left',
                    fontSize: 10, fontWeight: 500,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: 'var(--ink-3)',
                    borderBottom: '1px solid var(--line)',
                    whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transportes.map(t => {
                const isEditing = editId === t.id
                const isLoading = loadingId === t.id
                return (
                  <tr
                    key={t.id}
                    onClick={() => isSuperadmin && !isEditing && startEdit(t)}
                    style={{
                      borderTop: '1px solid var(--line)',
                      cursor: isSuperadmin && !isEditing ? 'pointer' : 'default',
                      background: isEditing ? 'var(--accent-soft)' : 'var(--surface)',
                      transition: 'background 80ms',
                    }}
                    onMouseEnter={e => { if (!isEditing) e.currentTarget.style.background = 'var(--row-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = isEditing ? 'var(--accent-soft)' : 'var(--surface)' }}
                  >
                    <td style={{ padding: '8px 16px', minWidth: 160 }}>
                      {isEditing ? (
                        <input type="text" value={editForm.nombre}
                          onChange={e => setEditForm(p => ({ ...p, nombre: e.target.value }))}
                          onClick={e => e.stopPropagation()} style={INPUT} autoFocus />
                      ) : (
                        <span style={{ fontWeight: 500, color: 'var(--ink-1)' }}>{t.nombre}</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 16px' }}>
                      {isEditing ? (
                        <input type="text" value={editForm.telefono}
                          onChange={e => setEditForm(p => ({ ...p, telefono: e.target.value }))}
                          onClick={e => e.stopPropagation()} style={INPUT} placeholder="—" />
                      ) : (
                        <span style={{ color: 'var(--ink-2)' }}>{t.telefono ?? '—'}</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 16px' }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={e => toggleActivo(t, e)}
                        disabled={isLoading}
                        style={{
                          padding: '2px 10px', borderRadius: 100, fontSize: 11, fontWeight: 500,
                          border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                          opacity: isLoading ? 0.5 : 1,
                          background: t.activo ? 'var(--ok-bg)' : 'var(--neutral-bg)',
                          color: t.activo ? 'var(--ok)' : 'var(--ink-3)',
                          transition: 'background 100ms',
                        }}
                      >
                        {t.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    {isSuperadmin && (
                      <td style={{ padding: '8px 16px' }} onClick={e => e.stopPropagation()}>
                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button onClick={saveEdit} disabled={isLoading || !editForm.nombre.trim()}
                              style={{ ...BTN_OK, opacity: isLoading || !editForm.nombre.trim() ? 0.5 : 1 }}>
                              {isLoading ? '...' : 'Guardar'}
                            </button>
                            <button onClick={() => setEditId(null)} style={BTN_SECONDARY}>Cancelar</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <IconBtn onClick={e => { e.stopPropagation(); startEdit(t) }} title="Editar">
                              <IconEdit />
                            </IconBtn>
                            <IconBtn onClick={e => deleteTransporte(t.id, e)} title="Eliminar" danger disabled={isLoading}>
                              <IconTrash />
                            </IconBtn>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNuevo && (
        <ModalNuevoTransporte
          onSave={t => { setTransportes(prev => [...prev, t].sort((a, b) => a.nombre.localeCompare(b.nombre))); setShowNuevo(false) }}
          onClose={() => setShowNuevo(false)}
        />
      )}
    </div>
  )
}

// ── icon button helper ────────────────────────────────────

function IconBtn({ children, onClick, title, danger, disabled }: {
  children: React.ReactNode
  onClick: (e: React.MouseEvent) => void
  title?: string
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        width: 26, height: 26, border: 'none', background: 'transparent',
        borderRadius: 'var(--radius)', color: 'var(--ink-3)',
        display: 'grid', placeItems: 'center', cursor: 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 80ms, color 80ms',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger ? 'var(--bad-bg)' : 'var(--surface-2)'
        e.currentTarget.style.color = danger ? 'var(--bad)' : 'var(--ink-1)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--ink-3)'
      }}
    >
      {children}
    </button>
  )
}

// ── Main export ───────────────────────────────────────────

export default function DashboardMaestros({ clientes, transportes, userRol }: Props) {
  const [tab, setTab] = useState<'clientes' | 'transportes'>('clientes')
  const isSuperadmin = userRol === 'superadmin'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink-1)', margin: '0 0 2px', letterSpacing: '-0.01em' }}>Maestros</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>Gestión de clientes y transportes</p>
        </div>

        {/* Segmented tab switcher */}
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 2, gap: 2 }}>
          {(['clientes', 'transportes'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '4px 14px', fontSize: 12, fontWeight: 500,
                borderRadius: 4, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: tab === t ? 'var(--surface)' : 'transparent',
                color: tab === t ? 'var(--ink-1)' : 'var(--ink-3)',
                boxShadow: tab === t ? 'var(--shadow-sm)' : 'none',
                transition: 'background 100ms, color 100ms',
              }}
            >
              {t === 'clientes' ? 'Clientes' : 'Transportes'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'clientes' ? (
        <TablaClientes clientes={clientes} isSuperadmin={isSuperadmin} />
      ) : (
        <TablaTransportes transportes={transportes} isSuperadmin={isSuperadmin} />
      )}
    </div>
  )
}

export { ModalCliente, ModalNuevoTransporte }
