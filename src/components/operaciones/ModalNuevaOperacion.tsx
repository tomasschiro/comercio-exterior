'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { NuevaOperacion, Cliente, Transporte } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  userEmail?: string
}

const EMPTY: NuevaOperacion = {
  interno: null,
  recep_doc: null,
  cliente: null,
  transporte: null,
  crt: null,
  senasa: null,
  senasa_estado: null,
  senasa_vinculacion: null,
  despacho: null,
  oficializacion: null,
  aviso: null,
  nota_entrega: null,
  liberacion: null,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  padding: '0 10px',
  fontSize: 14,
  border: '0.5px solid #E8E5DE',
  borderRadius: 6,
  outline: 'none',
  color: '#0D0D0D',
  background: '#FFFFFF',
  transition: 'border-color 100ms, box-shadow 100ms',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none',
  WebkitAppearance: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: '#6B6860',
  marginBottom: 4,
}

function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#18181B'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.06)'
}
function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#E8E5DE'
  e.currentTarget.style.boxShadow = 'none'
}

function MiniModal({ title, fields, onSave, onClose }: {
  title: string
  fields: { key: string; label: string; type?: string; required?: boolean }[]
  onSave: (data: Record<string, string>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f.key, '']))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await onSave(form)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
      setLoading(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', padding: 16 }}
    >
      <div style={{ background: '#FFFFFF', borderRadius: 10, width: '100%', maxWidth: 380, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '0.5px solid #E8E5DE' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#0D0D0D', margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9C9A94', display: 'flex', padding: 4, borderRadius: 4 }}>
            <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSave} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {fields.map(f => (
            <div key={f.key}>
              <label style={labelStyle}>{f.label}{f.required && ' *'}</label>
              <input
                type={f.type ?? 'text'}
                value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                style={inputStyle}
                onFocus={onFocus}
                onBlur={onBlur}
                required={f.required}
                autoFocus={fields.indexOf(f) === 0}
              />
            </div>
          ))}
          {error && <p style={{ fontSize: 12, color: '#DC2626', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4, borderTop: '0.5px solid #E8E5DE', marginTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ padding: '0 14px', height: 32, fontSize: 13, border: '0.5px solid #E8E5DE', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#6B6860' }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              style={{ padding: '0 14px', height: 32, fontSize: 13, fontWeight: 500, color: '#FFFFFF', background: loading ? '#52525B' : '#18181B', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ModalNuevaOperacion({ open, onClose, onCreated, userEmail }: Props) {
  const [form, setForm] = useState<NuevaOperacion>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [transportes, setTransportes] = useState<Transporte[]>([])
  const [showNuevoCliente, setShowNuevoCliente] = useState(false)
  const [showNuevoTransporte, setShowNuevoTransporte] = useState(false)

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    Promise.all([
      supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
      supabase.from('transportes').select('*').eq('activo', true).order('nombre'),
    ]).then(([{ data: c }, { data: t }]) => {
      setClientes(c ?? [])
      setTransportes(t ?? [])
    })
  }, [open])

  if (!open) return null

  function handleChange(field: keyof NuevaOperacion, value: string) {
    setForm(prev => ({
      ...prev,
      [field]: value === '' ? null : (field === 'interno' ? parseInt(value) || null : value),
    }))
  }

  function handleClienteSelect(value: string) {
    if (value === '__new__') { setShowNuevoCliente(true); return }
    handleChange('cliente', value)
  }

  function handleTransporteSelect(value: string) {
    if (value === '__new__') { setShowNuevoTransporte(true); return }
    handleChange('transporte', value)
  }

  async function handleSaveNuevoCliente(data: Record<string, string>) {
    const supabase = createClient()
    const { data: newC, error: dbErr } = await supabase
      .from('clientes')
      .insert({ nombre: data.nombre.trim(), email: data.email?.trim() || null, telefono: data.telefono?.trim() || null })
      .select()
      .single()
    if (dbErr) throw new Error(dbErr.message)
    setClientes(prev => [...prev, newC].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setForm(prev => ({ ...prev, cliente: newC.nombre }))
    setShowNuevoCliente(false)
  }

  async function handleSaveNuevoTransporte(data: Record<string, string>) {
    const supabase = createClient()
    const { data: newT, error: dbErr } = await supabase
      .from('transportes')
      .insert({ nombre: data.nombre.trim(), telefono: data.telefono?.trim() || null })
      .select()
      .single()
    if (dbErr) throw new Error(dbErr.message)
    setTransportes(prev => [...prev, newT].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setForm(prev => ({ ...prev, transporte: newT.nombre }))
    setShowNuevoTransporte(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('operaciones').insert({
      ...form,
      created_by: user?.id,
      created_by_email: userEmail || user?.email,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setForm(EMPTY)
    setLoading(false)
    onCreated()
    onClose()
  }

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <>
      <div
        onClick={handleBackdrop}
        style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', padding: 16 }}
      >
        <div style={{ background: '#FFFFFF', borderRadius: 10, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '0.5px solid #E8E5DE' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#0D0D0D', margin: 0 }}>Nueva Operación</h2>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9C9A94', display: 'flex', padding: 4, borderRadius: 4, transition: 'color 100ms' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#0D0D0D' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#9C9A94' }}
            >
              <svg style={{ width: 15, height: 15 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} style={{ padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>Interno</label>
                <input type="number" value={form.interno ?? ''} onChange={e => handleChange('interno', e.target.value)}
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur} placeholder="Nº interno" />
              </div>

              <div>
                <label style={labelStyle}>Recep. Documentos</label>
                <input type="date" value={form.recep_doc ?? ''} onChange={e => handleChange('recep_doc', e.target.value)}
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Cliente</label>
                {clientes.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36 }}>
                    <span style={{ fontSize: 13, color: '#9C9A94' }}>Sin clientes —</span>
                    <button type="button" onClick={() => setShowNuevoCliente(true)}
                      style={{ fontSize: 13, color: '#18181B', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                      + Agregar uno
                    </button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <select value={form.cliente ?? ''} onChange={e => handleClienteSelect(e.target.value)}
                      style={selectStyle} onFocus={onFocus} onBlur={onBlur}>
                      <option value="">— Sin cliente —</option>
                      {clientes.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                      <option value="__new__">+ Nuevo cliente</option>
                    </select>
                    <svg style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#9C9A94', pointerEvents: 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                )}
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Transporte</label>
                {transportes.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36 }}>
                    <span style={{ fontSize: 13, color: '#9C9A94' }}>Sin transportes —</span>
                    <button type="button" onClick={() => setShowNuevoTransporte(true)}
                      style={{ fontSize: 13, color: '#18181B', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                      + Agregar uno
                    </button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <select value={form.transporte ?? ''} onChange={e => handleTransporteSelect(e.target.value)}
                      style={selectStyle} onFocus={onFocus} onBlur={onBlur}>
                      <option value="">— Sin transporte —</option>
                      {transportes.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                      <option value="__new__">+ Nuevo transporte</option>
                    </select>
                    <svg style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#9C9A94', pointerEvents: 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                )}
              </div>

              <div>
                <label style={labelStyle}>CRT</label>
                <input type="text" value={form.crt ?? ''} onChange={e => handleChange('crt', e.target.value)}
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur} placeholder="Nº CRT" />
              </div>

              <div>
                <label style={labelStyle}>SENASA</label>
                <input type="text" value={form.senasa ?? ''} onChange={e => handleChange('senasa', e.target.value)}
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur} placeholder="Nº SENASA" />
              </div>

              <div>
                <label style={labelStyle}>N. Despacho</label>
                <input type="text" value={form.despacho ?? ''} onChange={e => handleChange('despacho', e.target.value)}
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur} placeholder="Nº despacho" />
              </div>

              <div>
                <label style={labelStyle}>Oficialización</label>
                <input type="date" value={form.oficializacion ?? ''} onChange={e => handleChange('oficializacion', e.target.value)}
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>

              <div>
                <label style={labelStyle}>Aviso</label>
                <input type="date" value={form.aviso ?? ''} onChange={e => handleChange('aviso', e.target.value)}
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>

              <div>
                <label style={labelStyle}>Nota de Entrega</label>
                <input type="date" value={form.nota_entrega ?? ''} onChange={e => handleChange('nota_entrega', e.target.value)}
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>

              <div>
                <label style={labelStyle}>Liberación</label>
                <input type="date" value={form.liberacion ?? ''} onChange={e => handleChange('liberacion', e.target.value)}
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>

            {error && (
              <div style={{ marginTop: 16, padding: '10px 14px', background: '#FEF2F2', border: '0.5px solid #FCA5A5', borderRadius: 6, fontSize: 13, color: '#DC2626' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24, paddingTop: 20, borderTop: '0.5px solid #E8E5DE' }}>
              <button type="button" onClick={onClose}
                style={{ padding: '0 16px', height: 32, fontSize: 13, border: '0.5px solid #E8E5DE', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#6B6860', transition: 'background 100ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F4F4F5' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                Cancelar
              </button>
              <button type="submit" disabled={loading}
                style={{ padding: '0 16px', height: 32, fontSize: 13, fontWeight: 500, color: '#FFFFFF', background: loading ? '#52525B' : '#18181B', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 120ms' }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#27272A' }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#18181B' }}>
                {loading ? 'Guardando...' : 'Guardar operación'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showNuevoCliente && (
        <MiniModal
          title="Nuevo cliente"
          fields={[
            { key: 'nombre', label: 'Nombre', required: true },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'telefono', label: 'Teléfono' },
          ]}
          onSave={handleSaveNuevoCliente}
          onClose={() => setShowNuevoCliente(false)}
        />
      )}

      {showNuevoTransporte && (
        <MiniModal
          title="Nuevo transporte"
          fields={[
            { key: 'nombre', label: 'Nombre', required: true },
            { key: 'telefono', label: 'Teléfono' },
          ]}
          onSave={handleSaveNuevoTransporte}
          onClose={() => setShowNuevoTransporte(false)}
        />
      )}
    </>
  )
}
